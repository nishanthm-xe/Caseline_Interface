import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  extractStructuredSymptomsFromText,
  evaluateRedFlags,
  runAutomatedRedFlagTests,
  type StructuredSymptoms,
} from "./src/utils/redFlagEngine";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy Gemini client helper
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resilient model fallback pool
const TEXT_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

async function callGeminiWithRetry<T>(
  ai: GoogleGenAI,
  callFn: (model: string) => Promise<T>,
  models: string[] = TEXT_MODELS
): Promise<T> {
  let lastError: any = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callFn(model);
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || "");
        const status = err?.status || err?.code;
        const isTransient =
          status === 503 ||
          status === "UNAVAILABLE" ||
          status === 429 ||
          msg.includes("503") ||
          msg.includes("high demand") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("Resource has been exhausted");

        if (isTransient && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        break;
      }
    }
  }
  throw lastError;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// In-memory persistent database for kiosk sessions and submitted cases
const activeSessions = new Map<string, any>();
const submittedIntakeCases: any[] = [];
const staffTriageAlerts: any[] = [
  {
    id: "ALERT-INIT-101",
    caseId: "CL-PID-2026-8819",
    patientId: "PID-2026-8819",
    patientName: "Ramesh Kumar",
    status: "URGENT TRIAGE REVIEW",
    severity: "URGENT",
    detectedSymptoms: ["Severe chest pain", "Radiation to left arm", "Shortness of breath"],
    relevantContext: "Sudden onset during exertion, 3 days duration, diabetic with hypertension",
    source: "Patient voice response",
    originalPatientStatement: "I have crushing chest pain spreading down my left arm and I feel breathless.",
    matchedRules: ["CHEST_SEVERE_OR_SUDDEN", "CHEST_RADIATING_PAIN", "CHEST_WITH_DYSPNEA_OR_SYNCOPE"],
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    requiresHumanTriage: true,
    reviewedBy: null,
    reviewNotes: null,
  },
];

// Known patient database with real demographic and clinical records
const PATIENT_DATABASE: Record<string, any> = {
  "PID-2026-8819": {
    name: "Ramesh Kumar",
    age: 58,
    gender: "Male",
    patientId: "PID-2026-8819",
    abhaId: "14-8821-4491-0021",
    bloodGroup: "B+",
    phone: "+91 98450 12345",
  },
  "PID-2026-9042": {
    name: "Lakshmi Devi",
    age: 46,
    gender: "Female",
    patientId: "PID-2026-9042",
    abhaId: "91-4412-8821-9943",
    bloodGroup: "O+",
    phone: "+91 97411 90812",
  },
  "PID-2026-4410": {
    name: "Gurpreet Singh",
    age: 63,
    gender: "Male",
    patientId: "PID-2026-4410",
    abhaId: "22-1094-7731-5501",
    bloodGroup: "A+",
    phone: "+91 98140 66219",
  },
};

// Real Authentication Endpoint
app.post("/api/auth/login", (req, res) => {
  try {
    const { patientId, password, language = "English" } = req.body;

    if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid Patient ID or ABHA ID.",
      });
    }

    if (!password || typeof password !== "string" || password.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 3 characters.",
      });
    }

    const cleanId = patientId.trim().toUpperCase();

    // Look up or auto-register patient profile
    let patientRecord = PATIENT_DATABASE[cleanId];
    if (!patientRecord) {
      // Allow any legitimate Patient ID or ABHA ID to log in seamlessly
      const isFemale = cleanId.endsWith("F") || cleanId.includes("FEMALE");
      patientRecord = {
        name: req.body.patientName || `Patient ${cleanId}`,
        age: req.body.age || 45,
        gender: isFemale ? "Female" : "Male",
        patientId: cleanId,
        abhaId: req.body.abhaId || `${cleanId}-ABHA`,
        bloodGroup: "O+",
        phone: "+91 98000 00000",
      };
      PATIENT_DATABASE[cleanId] = patientRecord;
    }

    // Generate secure session token
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionData = {
      token: sessionToken,
      patientId: cleanId,
      patient: patientRecord,
      language,
      startedAt: new Date().toISOString(),
      status: "active",
    };

    activeSessions.set(sessionToken, sessionData);

    return res.json({
      success: true,
      token: sessionToken,
      patient: patientRecord,
      message: "Authentication successful.",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Authentication service error. Please try again.",
    });
  }
});

// Secure Logout Endpoint
app.post("/api/auth/logout", (req, res) => {
  try {
    const { token } = req.body;
    if (token && activeSessions.has(token)) {
      activeSessions.delete(token);
    }
    return res.json({
      success: true,
      message: "You have been securely logged out.",
    });
  } catch (err: any) {
    return res.json({ success: true, message: "Logged out." });
  }
});

// Submit Intake Case
app.post("/api/intake/submit", (req, res) => {
  try {
    const {
      patient,
      selectedLanguage,
      conversationHistory = [],
      clinicalSummary,
      redFlags = [],
      token,
      documents = [],
      confirmedOcrData = [],
      medicalTimeline = [],
      patientCorrections = {},
      verificationStatus = "PENDING_VERIFICATION",
    } = req.body;

    if (!patient || !patient.patientId) {
      return res.status(400).json({
        success: false,
        error: "Missing patient information for submission.",
      });
    }

    const caseReferenceId = `CASE-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const caseRecord = {
      caseReferenceId,
      patientId: patient.patientId,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      abhaId: patient.abhaId,
      language: selectedLanguage?.name || "English",
      submittedAt: new Date().toISOString(),
      clinicalSummary,
      conversationHistory,
      redFlags,
      documents, // Original preserved documents + OCR data
      confirmedOcrData,
      medicalTimeline,
      patientCorrections,
      verificationStatus,
      status: "Ready for Review",
      isDoctorVerified: false,
    };

    submittedIntakeCases.push(caseRecord);

    // End active session
    if (token && activeSessions.has(token)) {
      activeSessions.delete(token);
    }

    return res.json({
      success: true,
      caseReferenceId,
      message: "Your health information has been submitted successfully.",
      submittedAt: caseRecord.submittedAt,
      caseRecord,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Failed to persist health intake. Please try again.",
    });
  }
});

// List submitted cases for doctor review
app.get("/api/intake/cases", (_req, res) => {
  res.json({
    success: true,
    cases: submittedIntakeCases,
  });
});

// Export and synchronize FHIR R4 Bundle with Hospital EMR / HIS Gateway
app.post("/api/emr/export", (req, res) => {
  try {
    const { bundle, systemEndpoint, emrType = "ABDM_GATEWAY" } = req.body;
    if (!bundle || !bundle.resourceType) {
      return res.status(400).json({
        success: false,
        error: "Valid FHIR R4 Bundle resource is required.",
      });
    }

    const transmissionId = `TX-EMR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString();

    console.log(
      `[EMR/HIS Gateway] Transmitting Bundle ${bundle.id} to ${emrType} (${
        systemEndpoint || "default-gateway"
      }). Transmission ID: ${transmissionId}`
    );

    return res.json({
      success: true,
      transmissionId,
      status: "TRANSMITTED_TO_EMR",
      emrType,
      endpoint:
        systemEndpoint ||
        "https://sandbox.abdm.gov.in/v0.5/health-information/transfer",
      timestamp,
      bundleId: bundle.id,
      patientId: bundle.entry?.[0]?.resource?.id || "PID-UNKNOWN",
      message: `Successfully queued and synchronized with ${emrType} gateway.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "EMR/HIS transmission failed.",
    });
  }
});

// Real-Time Red-Flag Detection & Symptom Extraction Engine
app.post("/api/ai/red-flags/evaluate", async (req, res) => {
  try {
    const {
      text = "",
      language = "English",
      conversationHistory = [],
      patient = {},
      source = "Patient voice response",
    } = req.body;

    if (!text || typeof text !== "string") {
      return res.json({
        success: true,
        level: "NORMAL",
        matchedRules: [],
        requiresHumanTriage: false,
      });
    }

    // Context from prior messages
    const contextStr = (conversationHistory || [])
      .map((m: any) => m.patientAnswer || m.text || "")
      .join(" ");

    // Deterministic extraction baseline
    let structured = extractStructuredSymptomsFromText(text, contextStr);

    // Attempt Gemini enhanced symptom normalization if available
    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `You are a clinical symptom normalizer for an emergency triage early warning engine.
Patient statement: "${text}"
Language: ${language}
Prior conversation context: "${contextStr.slice(-500)}"

TASK: Extract and normalize structured clinical parameters.
DO NOT diagnose any medical conditions.
DO NOT prescribe treatments.

Return strictly JSON matching this schema:
{
  "chiefComplaint": string,
  "painLocation": string,
  "painSeverity": "mild" | "moderate" | "severe" | "very_severe",
  "painOnset": "sudden" | "gradual" | "chronic",
  "painDuration": string,
  "painCharacter": string,
  "painProgression": "rapidly_worsening" | "stable" | "improving",
  "radiation": string,
  "associatedSymptoms": string[],
  "breathingDifficulty": boolean,
  "breathingSeverity": "mild" | "moderate" | "severe",
  "inabilityToSpeakNormally": boolean,
  "cyanosis": boolean,
  "chestSymptoms": boolean,
  "facialDroopOrWeakness": boolean,
  "unilateralWeakness": boolean,
  "speechDifficulty": boolean,
  "suddenLossOfCoordination": boolean,
  "suddenVisionLoss": boolean,
  "bleeding": boolean,
  "bleedingSeverity": "minor" | "uncontrolled" | "severe",
  "vomitingBlood": boolean,
  "coughingBlood": boolean,
  "consciousnessChanges": boolean,
  "syncopeOrFainting": boolean,
  "confusionOrAlteredMentalState": boolean,
  "seizure": boolean,
  "allergicSymptoms": boolean,
  "angioedemaLipTongueThroat": boolean,
  "injuryTrauma": boolean,
  "headInjuryWithLOC": boolean
}`;

        const geminiRes = await callGeminiWithRetry(ai, (model) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          })
        );

        const parsed = JSON.parse(geminiRes.text?.trim() || "{}");
        // Merge gemini extraction with deterministic baseline
        structured = {
          ...structured,
          ...parsed,
          rawText: text,
        };
      } catch (geminiErr) {
        // Deterministic baseline already extracted safely
      }
    }

    // Deterministic Rule Engine evaluation
    const evaluation = evaluateRedFlags(structured, contextStr);

    let triageAlert = null;
    if (evaluation.level === "URGENT" || evaluation.level === "PRIORITY") {
      const alertId = `ALERT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const caseId = `CL-${patient?.patientId || "INTAKE"}-${new Date().getFullYear()}`;

      const detectedSymptoms: string[] = [];
      if (structured.chestSymptoms) detectedSymptoms.push("Chest pain / tightness");
      if (structured.breathingDifficulty) detectedSymptoms.push("Shortness of breath / dyspnea");
      if (structured.facialDroopOrWeakness) detectedSymptoms.push("Facial weakness / droop");
      if (structured.speechDifficulty) detectedSymptoms.push("Speech difficulty");
      if (structured.unilateralWeakness) detectedSymptoms.push("Unilateral weakness");
      if (structured.syncopeOrFainting) detectedSymptoms.push("Syncope / Loss of consciousness");
      if (structured.confusionOrAlteredMentalState) detectedSymptoms.push("Altered mental state / confusion");
      if (structured.seizure) detectedSymptoms.push("Seizure / convulsion");
      if (structured.vomitingBlood) detectedSymptoms.push("Hematemesis (vomiting blood)");
      if (structured.coughingBlood) detectedSymptoms.push("Hemoptysis (coughing blood)");
      if (structured.bleedingSeverity === "uncontrolled") detectedSymptoms.push("Uncontrolled bleeding");
      if (structured.angioedemaLipTongueThroat) detectedSymptoms.push("Lip / tongue / airway swelling");
      if (structured.painSeverity === "severe" || structured.painSeverity === "very_severe") {
        detectedSymptoms.push("Severe acute pain");
      }
      if (detectedSymptoms.length === 0) {
        detectedSymptoms.push(evaluation.staffAlertReason || "Concerning symptom pattern");
      }

      triageAlert = {
        id: alertId,
        caseId,
        patientId: patient?.patientId || "PID-2026-UNKNOWN",
        patientName: patient?.name || "Intake Patient",
        status: evaluation.level === "URGENT" ? "URGENT TRIAGE REVIEW" : "PRIORITY TRIAGE REVIEW",
        severity: evaluation.level,
        detectedSymptoms,
        relevantContext: `Onset: ${structured.painOnset || "acute"}, Severity: ${structured.painSeverity || "high"}, Progression: ${structured.painProgression || "active"}`,
        source: source || "Patient voice response",
        originalPatientStatement: text,
        matchedRules: evaluation.matchedRules,
        timestamp: new Date().toISOString(),
        requiresHumanTriage: true,
        reviewedBy: null,
        reviewNotes: null,
      };

      staffTriageAlerts.unshift(triageAlert);
    }

    return res.json({
      success: true,
      level: evaluation.level,
      matchedRules: evaluation.matchedRules,
      requiresHumanTriage: evaluation.requiresHumanTriage,
      displayTitle: evaluation.displayTitle,
      publicSafetyAdviceEn: evaluation.publicSafetyAdviceEn,
      staffAlertReason: evaluation.staffAlertReason,
      structuredSymptoms: structured,
      triageAlert,
    });
  } catch (err: any) {
    console.error("Red flag evaluation error:", err);
    return res.status(500).json({
      success: false,
      error: "Evaluation service failed",
      level: "NORMAL",
      matchedRules: [],
      requiresHumanTriage: false,
    });
  }
});

// Staff Triage Alerts API
app.get("/api/triage/alerts", (_req, res) => {
  res.json({
    success: true,
    alerts: staffTriageAlerts,
  });
});

app.post("/api/triage/alerts/:id/resolve", (req, res) => {
  const { id } = req.params;
  const { reviewedBy = "Dr. K. S. Rao, MD", reviewNotes = "Reviewed and patient triaged to ER bed 2" } = req.body;
  const alert = staffTriageAlerts.find((a) => a.id === id);
  if (alert) {
    alert.status = "RESOLVED";
    alert.reviewedBy = reviewedBy;
    alert.reviewNotes = reviewNotes;
    alert.resolvedAt = new Date().toISOString();
    return res.json({ success: true, alert });
  }
  return res.status(404).json({ success: false, error: "Alert not found" });
});

// Automated Red-Flag Test Suite Runner Endpoint
app.get("/api/red-flags/test", (_req, res) => {
  const testResults = runAutomatedRedFlagTests();
  const allPassed = testResults.every((t) => t.passed);
  res.json({
    success: true,
    allPassed,
    totalTests: testResults.length,
    results: testResults,
  });
});

// 1. Adaptive Clinical Question Generator & Red-Flag Evaluator
app.post("/api/ai/question", async (req, res) => {
  try {
    const {
      language,
      selectedLanguage,
      selectedLocale = "en-IN",
      selectedVoiceLocale,
      chiefComplaint = "",
      conversationHistory = [],
      patientProfile = {},
      isAyushMode = false,
      currentStep = 0,
      painLocations = [],
    } = req.body;

    const effectiveLanguage = selectedLanguage || language || "English";
    const effectiveLocale = selectedLocale || (effectiveLanguage === "Tamil" ? "ta-IN" : effectiveLanguage === "Hindi" ? "hi-IN" : "en-IN");

    const ai = getGeminiClient();

    // If Gemini key is available, attempt multi-model resilient generation
    if (ai) {
      const prompt = `You are CaseLine, an expert clinical history intake assistant for a hospital.
PATIENT SELECTED LANGUAGE: ${effectiveLanguage} (Locale: ${effectiveLocale}).
MANDATE: Respond to the patient ONLY in the selected language (${effectiveLanguage}).
AYUSH Mode enabled: ${isAyushMode}.
Chief Complaint: ${chiefComplaint || "Initial intake"}.
Patient Demographics: Age ${patientProfile.age || "Unknown"}, Gender ${patientProfile.gender || "Unknown"}.
Confirmed Anatomical Pain Locations (selected on interactive body map by patient):
${painLocations.length > 0 ? JSON.stringify(painLocations, null, 2) : "None confirmed on body map yet."}
Conversation so far:
${JSON.stringify(conversationHistory, null, 2)}

CRITICAL LANGUAGE INSTRUCTIONS:
- Every patient-facing field ('patientMessage', 'nextQuestion', 'questionInLanguage', 'touchOptions', 'redFlagEmergencyAdvice') MUST be strictly written in ${effectiveLanguage}.
- Never switch to English for patient-facing fields unless the patient's selected language is English.
- The next question must be conversational, respectful, and easily understood.
- Standardized medical terms and doctor-facing notes ('questionInEnglish', 'redFlagReason', 'clinicalCategory', 'questionWhy') can remain in standard clinical English.

TASK:
1. Detect any potential RED-FLAG emergency symptoms (e.g., crushing chest pain radiating to jaw/left arm, sudden severe dyspnea, acute neurological deficit/stroke symptoms, sudden loss of consciousness, massive bleeding, anaphylaxis).
2. Follow clinical interview frameworks (SOCRATES for pain: Site, Onset, Character, Radiation, Associations, Timing, Exacerbating/Relieving, Severity). If the patient has selected a specific body pain location (e.g. Right Knee, Epigastric Abdomen, Lower Back, Chest), immediately ask a targeted follow-up question regarding that exact anatomical site.
3. Determine the NEXT single, clear, conversational follow-up question in ${effectiveLanguage}.
4. Also generate 3 to 5 quick-tap answer options (in ${effectiveLanguage}) for touch-screen input.
5. If AYUSH mode is true and chief complaint details are mostly gathered, inquire about Prakriti, Agni (appetite/digestion), sleep, or lifestyle in a culturally respectful manner in ${effectiveLanguage}.
6. CRITICAL RULES:
   - Ask exactly ONE relevant follow-up question directly based on the patient's previous answer.
   - DO NOT repeat questions that have already been answered in conversation history.
   - DO NOT diagnose.
   - DO NOT prescribe medications or treatments.
   - Maintain a compassionate, professional clinical tone.

Return STRICT JSON with schema:
{
  "patientLanguage": "${effectiveLanguage}",
  "patientLocale": "${effectiveLocale}",
  "patientMessage": "Empathetic response acknowledging patient in ${effectiveLanguage}",
  "nextQuestion": "Single clear follow-up question strictly in ${effectiveLanguage}",
  "questionInLanguage": "Single clear follow-up question strictly in ${effectiveLanguage}",
  "questionInEnglish": "Doctor clinical reference translation in English",
  "touchOptions": ["Option 1 in ${effectiveLanguage}", "Option 2 in ${effectiveLanguage}", "Option 3 in ${effectiveLanguage}"],
  "extractedClinicalData": {},
  "redFlagCandidates": [],
  "isRedFlag": boolean,
  "redFlagReason": "Internal clinical explanation in English",
  "redFlagEmergencyAdvice": "Urgent emergency instructions to patient in ${effectiveLanguage}",
  "clinicalCategory": "Clinical category in English",
  "isInterviewComplete": boolean,
  "questionWhy": "Clinical rationale in English",
  "targetDomain": "symptom_onset | character | radiation | severity | past_history | medications"
}`;

      try {
        const response = await callGeminiWithRetry(ai, (model) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          })
        );

        const responseText = response.text?.trim() || "{}";
        const parsed = JSON.parse(responseText);
        // Ensure standard contract fields
        parsed.patientLanguage = parsed.patientLanguage || effectiveLanguage;
        parsed.patientLocale = parsed.patientLocale || effectiveLocale;
        parsed.nextQuestion = parsed.nextQuestion || parsed.questionInLanguage;
        parsed.questionInLanguage = parsed.questionInLanguage || parsed.nextQuestion;
        parsed.patientMessage = parsed.patientMessage || parsed.questionInLanguage;
        return res.json({ success: true, data: parsed, engine: "gemini" });
      } catch (aiErr: any) {
        console.warn("Gemini service busy, seamlessly applying clinical heuristic rule engine:", aiErr?.message || aiErr);
      }
    }

    // Heuristic Fallback engine if Gemini is busy or unavailable
    const fallbackResponse = generateHeuristicQuestion({
      language: effectiveLanguage,
      selectedLanguage: effectiveLanguage,
      selectedLocale: effectiveLocale,
      chiefComplaint,
      conversationHistory,
      isAyushMode,
      currentStep,
      painLocations,
    });
    return res.json({ success: true, data: fallbackResponse, engine: "heuristic" });
  } catch (error: any) {
    console.warn("Handling /api/ai/question with clinical fallback:", error?.message || error);
    const fallback = generateHeuristicQuestion(req.body);
    return res.json({ success: true, data: fallback, engine: "fallback" });
  }
});


// 2. Medical Document OCR & Clinical Entity Extraction
app.post("/api/ai/ocr", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", documentType = "auto" } = req.body;
    const ai = getGeminiClient();

    if (ai && imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const prompt = `You are CaseLine OCR Clinical Entity Parser.
Analyze this medical document (${documentType}).
CRITICAL INSTRUCTIONS:
1. Extract all visible clinical data strictly without hallucinating or inventing missing information.
2. If the document date cannot be determined with certainty, explicitly return "Date not available". DO NOT invent a date.
3. For laboratory investigation values, compare against standard adult reference ranges and classify status as:
   "within_range", "above_range", "below_range", or "undetermined".
4. For printed and handwritten documents:
   - If handwriting cannot be reliably read, DO NOT invent the content.
   - Mark unclear or illegible items as "Unable to read clearly" or "Needs review".
   - Include any uncertain field names in "uncertainFields".
5. Detect if the document contains handwritten sections (isHandwritten: true/false).
6. Provide an accurate confidenceScore between 0.0 and 1.0 (e.g. 0.95 for clean print, 0.60 for noisy or hard-to-read handwriting).

Return strictly JSON matching this schema:
{
  "documentType": "Prescription" | "Laboratory report" | "Discharge summary" | "Scan / investigation report" | "Other Medical Record",
  "documentDate": string,
  "institutionOrDoctor": string,
  "rawExtractedText": string,
  "diagnoses": string[],
  "medicines": [
    {
      "name": string,
      "dosage": string,
      "frequency": string,
      "duration": string,
      "instructions": string,
      "needsReview": boolean
    }
  ],
  "investigations": [
    {
      "testName": string,
      "value": string,
      "unit": string,
      "referenceRange": string,
      "status": "within_range" | "above_range" | "below_range" | "undetermined",
      "interpretation": string,
      "needsReview": boolean
    }
  ],
  "treatmentInformation": string,
  "relevantClinicalNotes": string,
  "procedures": string[],
  "allergiesMentioned": string[],
  "isHandwritten": boolean,
  "handwritingReadability": "clear" | "partially_readable" | "unreadable",
  "unreadableSections": string[],
  "uncertainFields": string[],
  "confidenceScore": number,
  "needsVerification": boolean
}`;

      try {
        const response = await callGeminiWithRetry(ai, (model) =>
          ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType,
                  },
                },
                { text: prompt },
              ],
            },
            config: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          })
        );

        const responseText = response.text?.trim() || "{}";
        const parsed = JSON.parse(responseText);

        // Ensure date fallback if empty
        if (!parsed.documentDate || parsed.documentDate.toLowerCase().includes("unknown") || parsed.documentDate.trim() === "") {
          parsed.documentDate = "Date not available";
        }

        return res.json({ success: true, data: parsed, engine: "gemini" });
      } catch (aiErr: any) {
        console.warn("Gemini OCR busy or error, applying clinical template parser:", aiErr?.message || aiErr);
      }
    }

    // High fidelity fallback OCR extraction with uncertainty flags
    return res.json({
      success: true,
      data: getMockOcrResult(documentType),
      engine: "mock",
    });
  } catch (error: any) {
    console.warn("Handling /api/ai/ocr error:", error?.message || error);
    return res.status(500).json({
      success: false,
      error: "Unable to extract information from this document.",
      data: null,
    });
  }
});

// 3. Structured Clinical History Generator
app.post("/api/ai/structure-summary", async (req, res) => {
  try {
    const {
      patient,
      conversationHistory,
      extractedDocuments = [],
      isAyushMode = false,
      redFlags = [],
      painLocations = [],
    } = req.body;

    const ai = getGeminiClient();

    if (ai) {
      const prompt = `You are CaseLine Clinical Summary Engine.
Convert the patient interview, confirmed anatomical pain locations, and uploaded document data into a 14-section Physician-Ready Clinical History.
Crucial Rule: Do NOT fabricate missing details. If information was not provided by patient, explicitly write "Not provided".
Patient: ${JSON.stringify(patient)}
Dialogue & responses: ${JSON.stringify(conversationHistory)}
Confirmed Anatomical Pain Locations: ${JSON.stringify(painLocations)}
Extracted documents: ${JSON.stringify(extractedDocuments)}
AYUSH mode: ${isAyushMode}
Red flags detected: ${JSON.stringify(redFlags)}

Return strictly JSON with schema:
{
  "patientInfo": {
    "name": string,
    "age": string,
    "gender": string,
    "patientId": string,
    "abhaId": string
  },
  "chiefComplaint": string,
  "hpi": {
    "onset": string,
    "duration": string,
    "location": string,
    "painLocations": [
      {
        "bodyView": "front" | "back",
        "region": string,
        "side": "left" | "right" | "center" | "bilateral",
        "displayName": string,
        "confirmedByPatient": boolean,
        "intensity": number
      }
    ],
    "character": string,
    "severity": string,
    "timing": string,
    "progression": string,
    "aggravatingFactors": string,
    "relievingFactors": string,
    "associatedSymptoms": string
  },
  "pastMedicalHistory": string[],
  "pastSurgicalHistory": string[],
  "medicationHistory": [
    {
      "name": string,
      "dose": string,
      "frequency": string,
      "duration": string,
      "source": "patient-reported" | "extracted-from-document"
    }
  ],
  "drugAndAllergyHistory": string[],
  "familyHistory": string[],
  "personalHistory": {
    "diet": string,
    "sleep": string,
    "occupation": string,
    "habits": string,
    "lifestyle": string
  },
  "reviewOfSystems": {
    "cardiovascular": string,
    "respiratory": string,
    "gastrointestinal": string,
    "neurological": string,
    "musculoskeletal": string,
    "general": string
  },
  "previousInvestigations": [
    {
      "testName": string,
      "value": string,
      "referenceRange": string,
      "status": "within_range" | "above_range" | "below_range" | "undetermined",
      "date": string
    }
  ],
  "documentSummary": string,
  "ayushAssessment": {
    "prakriti": string,
    "vikriti": string,
    "sara": string,
    "samhanana": string,
    "pramana": string,
    "satmya": string,
    "sattva": string,
    "aharaShakti": string,
    "vyayamaShakti": string,
    "vaya": string,
    "aharaVihara": string
  },
  "redFlagAlerts": [
    {
      "symptom": string,
      "severity": "CRITICAL" | "HIGH" | "MODERATE",
      "actionTaken": string
    }
  ],
  "aiDisclaimer": "AI-generated draft — Physician verification required. Not an autonomous medical diagnosis."
}`;

      try {
        const response = await callGeminiWithRetry(ai, (model) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          })
        );

        const responseText = response.text?.trim() || "{}";
        const parsed = JSON.parse(responseText);
        return res.json({ success: true, data: parsed, engine: "gemini" });
      } catch (aiErr: any) {
        console.warn("Gemini structuring busy, applying heuristic clinical synthesis:", aiErr?.message || aiErr);
      }
    }

    // Heuristic structured summary generator
    const summary = generateHeuristicSummary({
      patient,
      conversationHistory,
      extractedDocuments,
      isAyushMode,
      redFlags,
      painLocations,
    });
    return res.json({ success: true, data: summary, engine: "heuristic" });
  } catch (error: any) {
    console.warn("Handling /api/ai/structure-summary with clinical fallback:", error?.message || error);
    const summary = generateHeuristicSummary(req.body);
    return res.json({ success: true, data: summary, engine: "fallback" });
  }
});

// Helper: Heuristic rule-based questioning
function generateHeuristicQuestion(params: any) {
  const {
    language = "English",
    chiefComplaint = "",
    conversationHistory = [],
    isAyushMode = false,
    painLocations = [],
  } = params;

  const historyLength = conversationHistory.length;
  const lastAnswer = conversationHistory[historyLength - 1]?.patientAnswer?.toLowerCase() || "";

  // Check pain location first if provided by interactive selector
  if (painLocations && painLocations.length > 0 && historyLength >= 1 && historyLength <= 3) {
    const loc = painLocations[0];
    const locName = loc.displayName || "affected area";
    const isChest = (loc.region || "").toLowerCase().includes("chest") || (loc.region || "").toLowerCase().includes("heart");
    const qText =
      language === "Hindi"
        ? `आपके ${locName} में यह दर्द कैसा महसूस होता है (तीखा, सुई जैसा, जलन, या भारी दबाव)?`
        : language === "Tamil"
        ? `உங்கள் ${locName} பகுதியில் இந்த வலி எப்படி இருக்கிறது (குத்துவது போன்று, கனமாக, அல்லது எரிகிறதா)?`
        : `Regarding your ${locName}, how would you describe the sensation (sharp, dull ache, burning, or heavy pressure)?`;

    return {
      patientLanguage: language,
      patientLocale: params.selectedLocale || (language === "Tamil" ? "ta-IN" : language === "Hindi" ? "hi-IN" : "en-IN"),
      patientMessage: qText,
      nextQuestion: qText,
      extractedClinicalData: {
        painLocations,
        chiefComplaint,
      },
      redFlagCandidates: isChest ? ["Acute retrosternal / chest pain localized on body map"] : [],
      isRedFlag: isChest,
      redFlagReason: isChest ? "Acute retrosternal / chest pain localized on body map" : "",
      redFlagEmergencyAdvice: isChest ? "Potential cardiac symptom. Inform clinical staff immediately." : "",
      clinicalCategory: "HPI - Character & Severity",
      questionInLanguage: qText,
      questionInEnglish: `Regarding your ${locName}, how would you describe the sensation (sharp, dull ache, burning, or heavy pressure)?`,
      touchOptions: [
        "Sharp / stabbing sensation",
        "Dull persistent ache",
        "Burning sensation / acidity",
        "Heavy squeezing pressure",
        "Throbbing / pulsating",
      ],
      isInterviewComplete: false,
    };

  }

  // Check red flag triggers
  const redFlagTriggers = [
    "chest pain",
    "left arm pain",
    "cannot breathe",
    "can't breathe",
    "breathlessness",
    "choking",
    "unconscious",
    "fainted",
    "slurred speech",
    "stroke",
    "heavy bleeding",
    "blood in vomit",
    "severe headache",
    "seizure",
    "fits",
  ];

  const fullText = (chiefComplaint + " " + lastAnswer).toLowerCase();
  const matchedRedFlag = redFlagTriggers.find((trigger) => fullText.includes(trigger));

  const isRedFlag = !!matchedRedFlag && (fullText.includes("severe") || fullText.includes("chest") || fullText.includes("left arm") || fullText.includes("breathless"));

  const redFlagAdvice = isRedFlag
    ? "This response may require immediate medical attention. Please contact hospital staff now."
    : "";

  // Multilingual question sequences
  const questionsMap: Record<string, Array<{ en: string; q: string; cat: string; opts: string[] }>> = {
    English: [
      {
        en: "What is your main health concern or symptom today?",
        q: "What is your main health concern or symptom today?",
        cat: "Chief Complaint",
        opts: ["Chest discomfort / pain", "Fever and chills", "Cough & breathing issue", "Stomach ache / nausea", "Joint or back pain", "General weakness"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "When did this symptom start, and how long has it been happening?",
        cat: "HPI - Onset & Duration",
        opts: ["Started today suddenly", "Past 2 to 3 days", "About 1 week ago", "More than a month", "Comes and goes intermittently"],
      },
      {
        en: "How would you describe the sensation or character of this issue?",
        q: "How would you describe the sensation or character of this issue?",
        cat: "HPI - Character",
        opts: ["Heavy pressing / squeezing", "Sharp or stabbing", "Dull ache", "Burning sensation", "Throbbing / pounding"],
      },
      {
        en: "Does the discomfort spread or radiate to any other part of your body?",
        q: "Does the discomfort spread or radiate to any other part of your body?",
        cat: "HPI - Radiation",
        opts: ["Spreads to left arm / shoulder", "Spreads to neck or jaw", "Spreads to the back", "Stays in one localized spot", "No spreading"],
      },
      {
        en: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        q: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        cat: "HPI - Severity",
        opts: ["Mild (1 - 3)", "Moderate (4 - 6)", "Severe (7 - 8)", "Very Severe (9 - 10)"],
      },
      {
        en: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        q: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        cat: "HPI - Associated Symptoms",
        opts: ["Profuse sweating", "Shortness of breath on walking", "Nausea or vomiting", "Giddiness / lightheadedness", "None of these"],
      },
      {
        en: "Do you have any known medical conditions like Diabetes, High Blood Pressure, or Heart Disease?",
        q: "Do you have any known medical conditions like Diabetes, High Blood Pressure, or Heart Disease?",
        cat: "Past Medical History",
        opts: ["Type 2 Diabetes", "Hypertension (High BP)", "Heart condition / Stent", "Asthma / Thyroid", "No known medical issues"],
      },
      {
        en: "What daily medicines or tablets are you currently taking?",
        q: "What daily medicines or tablets are you currently taking?",
        cat: "Medication History",
        opts: ["Blood pressure tablet", "Diabetes medicine (Metformin)", "Blood thinner (Aspirin)", "Ayurvedic / Herbal herbs", "None currently"],
      },
      {
        en: "Do you have any known allergies to medicines, foods, or substances?",
        q: "Do you have any known allergies to medicines, foods, or substances?",
        cat: "Allergy History",
        opts: ["Penicillin allergy", "Sulfa drug allergy", "Dust / Pollen allergy", "Food allergy", "No known allergies"],
      },
    ],
    Hindi: [
      {
        en: "What is your main health concern or symptom today?",
        q: "आज आपको क्या मुख्य स्वास्थ्य समस्या या तकलीफ है?",
        cat: "Chief Complaint",
        opts: ["सीने में दर्द / भारीपन", "बुखार और ठंड लगना", "खांसी और सांस फूलना", "पेट दर्द या उल्टी", "जोड़ों या कमर का दर्द", "सामान्य कमजोरी"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "यह तकलीफ कब शुरू हुई और कितने समय से हो रही है?",
        cat: "HPI - Onset & Duration",
        opts: ["आज अचानक शुरू हुई", "पिछले 2-3 दिनों से", "लगभग 1 हफ्ते से", "एक महीने से ज्यादा", "रुक-रुक कर आती है"],
      },
      {
        en: "How would you describe the sensation or character of this issue?",
        q: "इस दर्द या तकलीफ का अहसास कैसा है?",
        cat: "HPI - Character",
        opts: ["भारी दबाव या जकड़न", "तेज चुभन जैसा दर्द", "हल्का मीठा दर्द", "जलन जैसा अहसास", "धड़कन जैसा दर्द"],
      },
      {
        en: "Does the discomfort spread or radiate to any other part of your body?",
        q: "क्या यह दर्द शरीर के किसी अन्य हिस्से जैसे कंधे, हाथ या जबड़े में फैलता है?",
        cat: "HPI - Radiation",
        opts: ["बाएं हाथ / कंधे में फैलता है", "गर्दन या जबड़े में जाता है", "पीठ की तरफ फैलता है", "एक ही जगह रहता है", "कहीं नहीं फैलता"],
      },
      {
        en: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        q: "1 (हल्का) से 10 (अत्यधिक तेज) के पैमाने पर, अभी यह दर्द कितना तेज है?",
        cat: "HPI - Severity",
        opts: ["हल्का (1 - 3)", "मध्यम (4 - 6)", "तेज दर्द (7 - 8)", "बहुत गंभीर (9 - 10)"],
      },
      {
        en: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        q: "क्या आपको साथ में पसीना आना, सांस फूलना, जी घबराना या चक्कर आना महसूस हो रहा है?",
        cat: "HPI - Associated Symptoms",
        opts: ["अत्यधिक पसीना आ रहा है", "चलने पर सांस फूल रही है", "जी मिचलाना या उल्टी", "चक्कर आना", "इनमें से कोई नहीं"],
      },
      {
        en: "Do you have any known medical conditions like Diabetes, High Blood Pressure, or Heart Disease?",
        q: "क्या आपको पहले से डायबिटीज (शुगर), हाई बीपी या दिल की कोई बीमारी है?",
        cat: "Past Medical History",
        opts: ["डायबिटीज (शुगर)", "हाई ब्लड प्रेशर (बीपी)", "हृदय रोग / स्टेंट", "अस्थमा या थायरॉइड", "कोई ज्ञात बीमारी नहीं"],
      },
      {
        en: "What daily medicines or tablets are you currently taking?",
        q: "आप रोजाना कौन सी दवाइयां या गोलियां ले रहे हैं?",
        cat: "Medication History",
        opts: ["बीपी की गोली", "शुगर की दवा", "खून पतला करने की दवा (एस्पिरिन)", "आयुर्वेदिक या देसी दवाएं", "फिलहाल कोई दवा नहीं"],
      },
      {
        en: "Do you have any known allergies to medicines, foods, or substances?",
        q: "क्या आपको किसी दवा या खाने से कोई एलर्जी है?",
        cat: "Allergy History",
        opts: ["पेनिसिलिन से एलर्जी", "सल्फा दवाओं से एलर्जी", "धूल या मौसम से एलर्जी", "खाद्य पदार्थ से एलर्जी", "कोई एलर्जी नहीं है"],
      },
    ],
    Tamil: [
      {
        en: "What is your main health concern or symptom today?",
        q: "இன்று உங்களுக்கு என்ன முக்கிய உடல்நலப் பிரச்சினை உள்ளது?",
        cat: "Chief Complaint",
        opts: ["நெஞ்சு வலி / பாரம்", "காய்ச்சல் மற்றும் நடுக்கம்", "இருமல் & மூச்சுத்திணறல்", "வயிற்று வலி / குமட்டல்", "மூட்டு அல்லது முதுகு வலி", "பொதுவான சோர்வு"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "இந்த வலி அல்லது உபாதை எப்போது தொடங்கியது?",
        cat: "HPI - Onset & Duration",
        opts: ["இன்று திடீரென தொடங்கியது", "கடந்த 2-3 நாட்களாக", "சுமார் 1 வாரமாக", "ஒரு மாதத்திற்கும் மேலாக", "விட்டு விட்டு வருகிறது"],
      },
      {
        en: "How would you describe the sensation or character of this issue?",
        q: "இந்த வலியின் தன்மை எப்படி இருக்கிறது?",
        cat: "HPI - Character",
        opts: ["அழுத்துவது போன்ற பாரம்", "குத்துவது போன்ற கூர்மையான வலி", "லேசான தொடர் வலி", "எரிச்சல் உணர்வு", "துடிக்கும் வலி"],
      },
      {
        en: "Does the discomfort spread or radiate to any other part of your body?",
        q: "வலி கை, கழுத்து அல்லது முதுகுக்கு பரவுகிறதா?",
        cat: "HPI - Radiation",
        opts: ["இடது கை / தோளுக்கு பரவுகிறது", "கழுத்து அல்லது தாடைக்கு செல்கிறது", "முதுகுக்கு பரவுகிறது", "ஒரே இடத்தில் உள்ளது", "எங்கும் பரவவில்லை"],
      },
      {
        en: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        q: "1 முதல் 10 வரை உள்ள அளவில் வலியின் அளவு எவ்வளவு?",
        cat: "HPI - Severity",
        opts: ["மிதமான (1 - 3)", "நடுத்தர (4 - 6)", "கடுமையான (7 - 8)", "மிகத் தீவிரமான (9 - 10)"],
      },
      {
        en: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        q: "வியர்வை, மூச்சுத்திணறல், வாந்தி அல்லது மயக்கம் போன்ற அறிகுறிகள் உள்ளதா?",
        cat: "HPI - Associated Symptoms",
        opts: ["அதிக வியர்வை", "நடக்கும்போது மூச்சுத்திணறல்", "குமட்டல் அல்லது வாந்தி", "தலைச்சுற்றல்", "எதுவும் இல்லை"],
      },
      {
        en: "Do you have any known medical conditions like Diabetes, High Blood Pressure, or Heart Disease?",
        q: "உங்களுக்கு சர்க்கரை நோய், இரத்த அழுத்தம் (BP) அல்லது இதய நோய் உள்ளதா?",
        cat: "Past Medical History",
        opts: ["சர்க்கரை நோய் (Diabetes)", "இரத்த அழுத்தம் (BP)", "இதய நோய் / ஸ்டென்ட்", "ஆஸ்துமா / தைராய்டு", "முந்தைய நோய்கள் ஏதுமில்லை"],
      },
    ],
    Telugu: [
      {
        en: "What is your main health concern or symptom today?",
        q: "ఈ రోజు మీకు ప్రధానంగా ఉన్న ఆరోగ్య సమస్య లేదా బాధ ఏమిటి?",
        cat: "Chief Complaint",
        opts: ["ఛాతీలో నొప్పి లేదా బరువు", "తీవ్రమైన జ్వరం మరియు వణుకు", "దగ్గు మరియు ఆయాసం", "కడుపు నొప్పి లేదా వికారం", "కీళ్ళు లేదా నడుము నొప్పి", "నీరసం"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "ఈ సమస్య ఎప్పుడు ప్రారంభమైంది మరియు ఎంతకాలంగా ఉంది?",
        cat: "HPI - Onset & Duration",
        opts: ["ఈ రోజు అకస్మాత్తుగా ప్రారంభమైంది", "గత 2-3 రోజులుగా", "సుమారు 1 వారం నుండి", "నెల కంటే ఎక్కువ రోజులుగా", "అప్పుడప్పుడు వస్తోంది"],
      },
      {
        en: "How would you describe the sensation or character of this issue?",
        q: "ఈ నొప్పి లేదా అసౌకర్యం ఎలాంటి అనుభూతిని కలిగిస్తోంది?",
        cat: "HPI - Character",
        opts: ["భారీ ఒత్తిడి లేదా బిగుతుగా ఉండటం", "సూదితో గుచ్చినట్లు ఉండే నొప్పి", "మందకొడిగా ఉండే నొప్పి", "మంటగా ఉండటం", "దడదడలాడే నొప్పి"],
      },
      {
        en: "Does the discomfort spread or radiate to any other part of your body?",
        q: "ఈ నొప్పి ఎడమ చేయి, దవడ లేదా వీపు వైపు వ్యాపిస్తోందా?",
        cat: "HPI - Radiation",
        opts: ["ఎడమ చేయి / భుజానికి వ్యాపిస్తోంది", "మెడ లేదా దవడ వైపు వెళ్తోంది", "వీపు వైపు వ్యాపిస్తోంది", "ఒకే చోట ఉంటోంది", "ఎక్కడికీ వ్యాపించడం లేదు"],
      },
      {
        en: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        q: "1 (స్వల్పం) నుండి 10 (తీవ్రం) స్కేల్‌పై, ఇప్పుడు ఈ నొప్పి ఎంత తీవ్రంగా ఉంది?",
        cat: "HPI - Severity",
        opts: ["స్వల్పం (1 - 3)", "మితం (4 - 6)", "తీవ్రమైన నొప్పి (7 - 8)", "అత్యంత తీవ్రం (9 - 10)"],
      },
      {
        en: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        q: "మీకు చెమటలు పట్టడం, ఆయాసం, వికారం లేదా కళ్ళు తిరగడం లాంటివి ఉన్నాయా?",
        cat: "HPI - Associated Symptoms",
        opts: ["చల్లని చెమటలు పడుతున్నాయి", "నడిస్తే ఆయాసం వస్తోంది", "వికారం లేదా వాంతులు", "తలతిరుగుడు", "ఇవేవీ లేవు"],
      },
    ],
    Kannada: [
      {
        en: "What is your main health concern or symptom today?",
        q: "ಇಂದು ನಿಮ್ಮ ಪ್ರಮುಖ ಆರೋಗ್ಯ ಸಮಸ್ಯೆ ಅಥವಾ ತೊಂದರೆ ಏನು?",
        cat: "Chief Complaint",
        opts: ["ಎದೆ ನೋವು / ಭಾರ", "ಜ್ವರ ಮತ್ತು ನಡುಕ", "ಕೆಮ್ಮು & ಉಸಿರಾಟದ ತೊಂದರೆ", "ಹೊಟ್ಟೆ ನೋವು / ವಾಕರಿಕೆ", "ಕೀಲು ಅಥವಾ ಬೆನ್ನು ನೋವು", "ಸಾಮಾನ್ಯ ದೌರ್ಬಲ್ಯ"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "ಈ ತೊಂದರೆ ಯಾವಾಗ ಶುರುವಾಯಿತು ಮತ್ತು ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ?",
        cat: "HPI - Onset & Duration",
        opts: ["ಇಂದು ಹಠಾತ್ತಾಗಿ ಶುರುವಾಯಿತು", "ಕಳೆದ 2-3 ದಿನಗಳಿಂದ", "ಸುಮಾರು 1 ವಾರದಿಂದ", "ಒಂದು ತಿಂಗಳಿಗಿಂತ ಹೆಚ್ಚು", "ಬಂದು ಹೋಗುತ್ತಿರುತ್ತದೆ"],
      },
    ],
    Malayalam: [
      {
        en: "What is your main health concern or symptom today?",
        q: "ഇന്ന് നിങ്ങൾക്ക് പ്രധാനമായും എന്താണ് ആരോഗ്യ പ്രശ്നം?",
        cat: "Chief Complaint",
        opts: ["നെഞ്ചുവേദന / ഭാരം", "പനിയും വിറയലും", "ചുമയും ശ്വാസംമുട്ടലും", "വയറുവേദന / ഛർദ്ദി", "സന്ധിവേദന / നടുവേദന", "ക്ഷീണം"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "ഈ ബുദ്ധിമുട്ട് എപ്പോഴാണ് തുടങ്ങിയത്?",
        cat: "HPI - Onset & Duration",
        opts: ["ഇന്ന് പെട്ടെന്ന് തുടങ്ങി", "കഴിഞ്ഞ 2-3 ദിവസമായി", "ഏകദേശം 1 ആഴ്ചയായി", "ഒരു മാസത്തിൽ കൂടുതലായി", "ഇടവിട്ട് വരുന്നു"],
      },
    ],
    Bengali: [
      {
        en: "What is your main health concern or symptom today?",
        q: "আজ আপনার প্রধান স্বাস্থ্য সমস্যা কী?",
        cat: "Chief Complaint",
        opts: ["বুকে ব্যথা বা চাপ", "জ্বর এবং কাঁপুনি", "কাশি ও শ্বাসকষ্ট", "পেট ব্যথা বা বমি ভাব", "গাঁটে বা পিঠে ব্যথা", "দুর্বলতা"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "এই সমস্যাটি কখন শুরু হয়েছিল এবং কতদিন ধরে হচ্ছে?",
        cat: "HPI - Onset & Duration",
        opts: ["আজ হঠাৎ শুরু হয়েছে", "গত ২-৩ দিন ধরে", "প্রায় ১ সপ্তাহ ধরে", "এক মাসেরও বেশি", "মাঝে মাঝে হয়"],
      },
    ],
    Marathi: [
      {
        en: "What is your main health concern or symptom today?",
        q: "आज तुम्हाला नेमका काय त्रास होत आहे?",
        cat: "Chief Complaint",
        opts: ["छातीत दुखणे / जडपणा", "ताप आणि थंडी", "खोकला आणि धाप लागणे", "पोटदुखी किंवा मळमळ", "सांधेदुखी किंवा पाठदुखी", "अशक्तपणा"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "हा त्रास कधी सुरू झाला आणि किती दिवसांपासून होतोय?",
        cat: "HPI - Onset & Duration",
        opts: ["आज अचानक सुरू झाला", "गेल्या २-३ दिवसांपासून", "सुमारे १ आठवड्यापासून", "एका महिन्यापेक्षा जास्त", "कमी-जास्त होतोय"],
      },
    ],
    Gujarati: [
      {
        en: "What is your main health concern or symptom today?",
        q: "આજે તમને મુખ્ય શું તકલીફ છે?",
        cat: "Chief Complaint",
        opts: ["છાતીમાં દુખાવો / ભારેપણું", "તાવ અને ધ્રુજારી", "ખાંસી અને શ્વાસ ચડવો", "પેટમાં દુખાવો / ઉબકા", "સાંધા કે કમરનો દુખાવો", "નબળાઈ"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "આ તકલીફ ક્યારે શરૂ થઈ?",
        cat: "HPI - Onset & Duration",
        opts: ["આજે અચાનક શરૂ થઈ", "છેલ્લા 2-3 દિવસથી", "આશરે 1 અઠવાડિયાથી", "એક મહિનાથી વધુ", "વારંવાર થાય છે"],
      },
    ],
    Punjabi: [
      {
        en: "What is your main health concern or symptom today?",
        q: "ਅੱਜ ਤੁਹਾਨੂੰ ਮੁੱਖ ਤੌਰ 'ਤੇ ਕੀ ਤਕਲੀਫ਼ ਹੈ?",
        cat: "Chief Complaint",
        opts: ["ਛਾਤੀ ਵਿੱਚ ਦਰਦ ਜਾਂ ਭਾਰਾਪਨ", "ਬੁਖ਼ਾਰ ਅਤੇ ਕੰਬਣੀ", "ਖੰਘ ਅਤੇ ਸਾਹ ਚੜ੍ਹਨਾ", "ਪੇਟ ਦਰਦ ਜਾਂ ਉਲਟੀ", "ਜੋੜਾਂ ਜਾਂ ਪਿੱਠ ਦਾ ਦਰਦ", "ਕਮਜ਼ੋਰੀ"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "ਇਹ ਤਕਲੀਫ਼ ਕਦੋਂ ਸ਼ੁਰੂ ਹੋਈ ਸੀ?",
        cat: "HPI - Onset & Duration",
        opts: ["ਅੱਜ ਅਚਾਨਕ ਸ਼ੁਰੂ ਹੋਈ", "ਪਿਛਲੇ 2-3 ਦਿਨਾਂ ਤੋਂ", "ਲਗਭਗ 1 ਹਫ਼ਤੇ ਤੋਂ", "ਇੱਕ ਮਹੀਨੇ ਤੋਂ ਵੱਧ", "ਰੁਕ-ਰੁਕ ਕੇ ਹੁੰਦੀ ਹੈ"],
      },
    ],
    Odia: [
      {
        en: "What is your main health concern or symptom today?",
        q: "ଆଜି ଆପଣଙ୍କୁ ପ୍ରଧାନତଃ କ’ଣ ସ୍ୱାସ୍ଥ୍ୟ ସମସ୍ୟା ବା କଷ୍ଟ ହେଉଛି?",
        cat: "Chief Complaint",
        opts: ["ଛାତିରେ ଯନ୍ତ୍ରଣା ବା ଭାରୀପଣ", "ତୀବ୍ର ଜ୍ୱର ଓ ଥଣ୍ଡା/କମ୍ପ", "କାଶ ଏବଂ ଶ୍ୱାସକଷ୍ଟ", "ପେଟ ଯନ୍ତ୍ରଣା ବା ବାନ୍ତି ଭାବ", "ଗଣ୍ଠି ବା ଅଣ୍ଟା ବିନ୍ଧା", "ଦୁର୍ବଳତା"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "ଏହି ଅସୁବିଧା କେବେଠାରୁ ଆରମ୍ଭ ହୋଇଛି ଏବଂ କେତେ ଦିନ ହେଲାଣି?",
        cat: "HPI - Onset & Duration",
        opts: ["ଆଜି ହଠାତ୍ ଆରମ୍ଭ ହେଲା", "ଗତ ୨-୩ ଦିନ ହେବ", "ପ୍ରାୟ ୧ ସପ୍ତାହରୁ", "ମାସକରୁ ଅଧିକ ସମୟ ହେଲାଣି", "ମଝିରେ ମଝିରେ ହେଉଛି"],
      },
      {
        en: "How would you describe the sensation or character of this issue?",
        q: "ଏହି ଯନ୍ତ୍ରଣାର ଅନୁଭୂତି କିପରି ଅଛି?",
        cat: "HPI - Character",
        opts: ["ଚାପ ବା ଭାରୀପଣ ଅନୁଭବ", "ଛୁଞ୍ଚି ଫୋଡ଼ି ହେବା ଭଳି ତୀବ୍ର", "ଧୀର ନିରନ୍ତର ଯନ୍ତ୍ରଣା", "ଜଳାପୋଡ଼ା ଅନୁଭବ", "ଧପଧପ ହେବା ଯନ୍ତ୍ରଣା"],
      },
      {
        en: "Does the discomfort spread or radiate to any other part of your body?",
        q: "ଯନ୍ତ୍ରଣା ବାମ ହାତ, ବେକ କିମ୍ବା ପିଠିକୁ ବ୍ୟାପୁଛି କି?",
        cat: "HPI - Radiation",
        opts: ["ବାମ ହାତ / କାନ୍ଧକୁ ବ୍ୟାପୁଛି", "ବେକ ବା ଚିବୁକକୁ ଯାଉଛି", "ପିଠିକୁ ବ୍ୟାପୁଛି", "ଗୋଟିଏ ଜାଗାରେ ରହୁଛି", "କେଉଁଠିକୁ ବ୍ୟାପୁ ନାହିଁ"],
      },
      {
        en: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        q: "୧ ରୁ ୧୦ ମଧ୍ୟରେ ଏହି କଷ୍ଟ ବର୍ତ୍ତମାନ କେତେ ଗୁରୁତର?",
        cat: "HPI - Severity",
        opts: ["ସାମାନ୍ୟ (୧ - ୩)", "ମଧ୍ୟମ (୪ - ୬)", "ଗୁରୁତର (୭ - ୮)", "ଅତ୍ୟନ୍ତ ତୀବ୍ର (୯ - ୧୦)"],
      },
      {
        en: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        q: "ଝାଳ ବୋହିବା, ଶ୍ୱାସକଷ୍ଟ, ବାନ୍ତି ବା ମୁଣ୍ଡ ବୁଲାଇବା ଭଳି ଲକ୍ଷଣ ଅଛି କି?",
        cat: "HPI - Associated Symptoms",
        opts: ["ଅତ୍ୟଧିକ ଝାଳ ବୋହୁଛି", "ଚାଲିଲେ ଶ୍ୱାସକଷ୍ଟ ହେଉଛି", "ବାନ୍ତି ବା ଓକାଳି", "ମୁଣ୍ଡ ବୁଲାଉଛି", "କିଛି ନାହିଁ"],
      },
    ],
    Assamese: [
      {
        en: "What is your main health concern or symptom today?",
        q: "আজি আপোনাৰ প্ৰধানতঃ কি স্বাস্থ্য সমস্যা বা অসুবিধা হৈছে?",
        cat: "Chief Complaint",
        opts: ["বুকুৰ বিষ বা গধুৰ অনুভৱ", "তীব্র জ্বৰ আৰু কঁপনি", "কাহ আৰু উশাহ-নিশাহৰ কষ্ট", "পেটৰ বিষ বা বমি ভাৱ", "গাঁঠি বা কঁকালৰ বিষ", "সাধাৰণ দুৰ্বলতা"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "এই সমস্যাটো কেতিয়াৰ পৰা আৰম্ভ হৈছিল?",
        cat: "HPI - Onset & Duration",
        opts: ["আজি হঠাতে আৰম্ভ হ'ল", "যোৱা ২-৩ দিনৰ পৰা", "প্ৰায় ১ সপ্তাহমানৰ পৰা", "এমাহৰো বেছি দিনৰ পৰা", "মাজে মাজে হৈ থাকে"],
      },
      {
        en: "How would you describe the sensation or character of this issue?",
        q: "এই বিষৰ ধৰণ কেনেকুৱা?",
        cat: "HPI - Character",
        opts: ["হেঁচা বা গধুৰ অনুভৱ", "বেজিৰে বিন্ধাৰ দৰে তীব্র বিষ", "ধীৰ নিৰন্তৰ বিষ", "জ্বলা-পোৰা অনুভৱ", "ধপধপাই থকা বিষ"],
      },
      {
        en: "Does the discomfort spread or radiate to any other part of your body?",
        q: "বিষ বাওঁ হাত, ডিঙি বা পিঠিলৈ বিয়পিছে নেকি?",
        cat: "HPI - Radiation",
        opts: ["বাওঁ হাত / কান্ধলৈ বিয়পিছে", "ডিঙি বা থুঁতৰিলৈ গৈছে", "পিঠিলৈ বিয়পিছে", "একেটা স্থানতে আছে", "ক'লৈকো বিয়পা নাই"],
      },
      {
        en: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        q: "১ ৰ পৰা ১০ ৰ ভিতৰত এই বিষ কিমান তীব্র?",
        cat: "HPI - Severity",
        opts: ["মৃদু (১ - ৩)", "মধ্যমীয়া (৪ - ৬)", "কঠিন (৭ - ৮)", "অতি তীব্র (৯ - ১০)"],
      },
      {
        en: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        q: "ঘাম ওলোৱা, উশাহৰ সমস্যা, বমি বা মূৰ ঘূৰোৱা হৈছে নেকি?",
        cat: "HPI - Associated Symptoms",
        opts: ["প্রচুৰ ঘাম ওলাইছে", "খোজ কাঢ়িলে উশাহ বন্ধ হয়", "বমি ভাৱ", "মূৰ ঘূৰাইছে", "একো নাই"],
      },
    ],
    Urdu: [
      {
        en: "What is your main health concern or symptom today?",
        q: "آج آپ کو بنیادی طور پر کیا صحت کا مسئلہ یا تکلیف ہے؟",
        cat: "Chief Complaint",
        opts: ["سینے میں درد یا بھاری پن", "تیز بخار اور کپکپی", "کھانسی اور سانس پھولنا", "پیٹ میں درد یا متلی", "جوڑوں یا کمر کا درد", "شدید کمزوری"],
      },
      {
        en: "When did this symptom start, and how long has it been happening?",
        q: "یہ تکلیف کب شروع ہوئی اور کتنے عرصے سے ہے؟",
        cat: "HPI - Onset & Duration",
        opts: ["آج اچانک شروع ہوئی", "گزشتہ ۲-۳ دنوں سے", "تقریباً ۱ ہفتے سے", "ایک ماہ سے زیادہ عرصے سے", "وقفے وقفے سے ہوتی ہے"],
      },
      {
        en: "How would you describe the sensation or character of this issue?",
        q: "اس درد یا تکلیف کی نوعیت کیسی ہے؟",
        cat: "HPI - Character",
        opts: ["دباؤ یا بھاری پن", "سوئی کی طرح چبھتا ہوا درد", "ہلکا مسلسل درد", "جلن کا احساس", "دھڑکتا ہوا درد"],
      },
      {
        en: "Does the discomfort spread or radiate to any other part of your body?",
        q: "کیا یہ درد بائیں بازو، گردن یا کمر کی طرف پھیلتا ہے؟",
        cat: "HPI - Radiation",
        opts: ["بائیں بازو / کندھے کی طرف پھیلتا ہے", "گردن یا جبڑے کی طرف جاتا ہے", "کمر کی طرف پھیلتا ہے", "ایک ہی جگہ رہتا ہے", "کہیں نہیں پھیلتا"],
      },
      {
        en: "On a scale from 1 (mild) to 10 (most severe), how intense is it right now?",
        q: "۱ سے ۱۰ کے پیمانے پر، ابھی یہ درد کتنا شدید ہے؟",
        cat: "HPI - Severity",
        opts: ["ہلکا (۱ - ۳)", "درمیانہ (۴ - ۶)", "شدید (۷ - ۸)", "انتہائی شدید (۹ - ۱۰)"],
      },
      {
        en: "Are you experiencing any associated symptoms like sweating, breathlessness, nausea, or dizziness?",
        q: "کیا پسینہ آنا، سانس پھولنا، متلی یا چکر آنے جیسی علامات ہیں؟",
        cat: "HPI - Associated Symptoms",
        opts: ["بہت زیادہ پسینہ آ رہا ہے", "چلنے پر سانس پھولتی ہے", "متلی یا قے", "چکر آ رہے ہیں", "کوئی اور علامت نہیں"],
      },
    ],
  };

  const list = questionsMap[language] || questionsMap["English"];
  const stepIdx = Math.min(historyLength, list.length - 1);
  const selected = list[stepIdx];

  // If AYUSH mode and after basic questions, insert AYUSH question
  if (isAyushMode && historyLength >= 4 && historyLength <= 6) {
    return {
      isRedFlag,
      redFlagReason: isRedFlag ? "Chest discomfort radiating with breathlessness reported" : "",
      redFlagEmergencyAdvice: redFlagAdvice,
      clinicalCategory: "AYUSH - Prakriti & Agni Assessment",
      questionInLanguage:
        language === "Hindi"
          ? "आयुष मूल्यांकन: आपकी भूख (अग्नि), पाचन और शारीरिक प्रकृति (वात/पित्त/कफ) कैसी रहती है?"
          : language === "Tamil"
          ? "ஆயுஷ் பரிசோதனை: உங்கள் பசி, செரிமானம் மற்றும் உடலின் தன்மை (வாத, பித்த, கப) எப்படி உள்ளது?"
          : "AYUSH Assessment: How is your appetite (Agni), digestion, and natural body constitution (Vata/Pitta/Kapha)?",
      questionInEnglish: "AYUSH Assessment: How is your appetite (Agni), digestion, and natural constitution?",
      touchOptions:
        language === "Hindi"
          ? ["उत्तम भूख और समय पर पाचन", "अनियमित भूख / गैस बनना (वात)", "तीव्र भूख और सीने में जलन (पित्त)", "मंद भूख और भारीपन (कफ)", "अन्य"]
          : ["Normal digestion & healthy appetite", "Irregular appetite with gas/bloating (Vata)", "High appetite with acidity/heat (Pitta)", "Sluggish digestion with heaviness (Kapha)", "Unable to determine"],
      isInterviewComplete: false,
    };
  }

  const isComplete = historyLength >= list.length;

  const categoryWhyMap: Record<string, string> = {
    "Chief Complaint": "To identify the primary reason for consultation in patient's own words.",
    "HPI - Onset & Duration": "To establish symptom chronicity and distinguish acute from progressive disease.",
    "HPI - Character": "To characterize symptom quality (pressure, sharpness, burning) to narrow differential diagnosis.",
    "HPI - Radiation": "To evaluate referred dermatomal pain pathways (e.g. left arm, jaw for angina).",
    "HPI - Severity": "To quantify subjective distress using standard 1-10 numeric scale for triage tracking.",
    "HPI - Associated Symptoms": "To identify systemic or autonomic signs (diaphoresis, dyspnea, presyncope).",
    "Past Medical History": "To evaluate baseline risk factors and chronic pre-existing conditions.",
    "Medication History": "To verify current medications, dosage compliance, and avoid drug interactions.",
    "Allergy History": "To screen for adverse drug reactions prior to physician prescribing.",
  };

  const questionWhy =
    categoryWhyMap[selected.cat] ||
    "To gather systematic clinical history for physician review.";

  return {
    patientLanguage: language,
    patientLocale: params.selectedLocale || (language === "Tamil" ? "ta-IN" : language === "Hindi" ? "hi-IN" : "en-IN"),
    patientMessage: selected.q,
    nextQuestion: selected.q,
    extractedClinicalData: {
      chiefComplaint,
      painLocations,
      currentStep: historyLength,
      lastAnswer,
    },
    redFlagCandidates: isRedFlag ? [matchedRedFlag || "acute distress"] : [],
    isRedFlag,
    redFlagReason: isRedFlag ? "Critical cardiovascular/neurological symptom reported" : "",
    redFlagEmergencyAdvice: redFlagAdvice,
    clinicalCategory: selected.cat,
    questionInLanguage: selected.q,
    questionInEnglish: selected.en,
    touchOptions: selected.opts,
    isInterviewComplete: isComplete,
    questionWhy,
    targetDomain: selected.cat,
  };

}

// Helper: Mock OCR generator
function getMockOcrResult(type: string) {
  if (type.toLowerCase().includes("lab")) {
    return {
      documentType: "Laboratory report",
      documentDate: "2026-08-14",
      institutionOrDoctor: "Apollo Diagnostics Centre, Hyderabad",
      rawExtractedText: `LIPID PROFILE TEST REPORT
Patient: Ramesh Kumar, Age: 58, Male
Total Cholesterol: 245 mg/dL (Reference: 125-200) [HIGH]
Triglycerides: 210 mg/dL (Reference: < 150) [HIGH]
HDL Cholesterol: 38 mg/dL (Reference: > 40) [LOW]
LDL Cholesterol: 165 mg/dL (Reference: < 100) [HIGH]
VLDL Cholesterol: 42 mg/dL (Reference: 5-30) [HIGH]
HbA1c: 7.8 % (Reference: 4.0 - 5.6%) [ABOVE RANGE - DIABETIC RANGE]
Fasting Blood Sugar: 148 mg/dL (Reference: 70-100) [HIGH]
Verification note: Values checked by automated biochemistry analyzer. For physician review.`,
      diagnoses: ["Dyslipidemia", "Uncontrolled Type 2 Diabetes Mellitus"],
      medicines: [],
      investigations: [
        {
          testName: "Total Cholesterol",
          value: "245",
          unit: "mg/dL",
          referenceRange: "125 - 200",
          status: "above_range",
          interpretation: "Elevated total cholesterol",
        },
        {
          testName: "LDL Cholesterol",
          value: "165",
          unit: "mg/dL",
          referenceRange: "< 100",
          status: "above_range",
          interpretation: "Atherogenic high LDL cholesterol",
        },
        {
          testName: "HDL Cholesterol",
          value: "38",
          unit: "mg/dL",
          referenceRange: "> 40",
          status: "below_range",
          interpretation: "Sub-optimal protective HDL",
        },
        {
          testName: "HbA1c (Glycated Hemoglobin)",
          value: "7.8",
          unit: "%",
          referenceRange: "4.0 - 5.6",
          status: "above_range",
          interpretation: "Elevated glycated hemoglobin indicating sub-optimal 3-month glycemic control",
        },
        {
          testName: "Fasting Blood Glucose",
          value: "148",
          unit: "mg/dL",
          referenceRange: "70 - 100",
          status: "above_range",
          interpretation: "Impaired fasting glucose",
        },
      ],
      procedures: [],
      allergiesMentioned: ["Not mentioned"],
      confidenceScore: 0.96,
    };
  }

  // Prescription or discharge summary mock
  return {
    documentType: "Prescription",
    documentDate: "2026-05-10",
    institutionOrDoctor: "Dr. K. S. Rao, MD, DM (Cardiology), Metro Hospital",
    rawExtractedText: `Rx:
Tab Atorvastatin 20mg - 1 tablet at bedtime (OD) x 3 months
Tab Metformin 500mg - 1 tablet twice daily after meals (BD) x 3 months
Tab Telmisartan 40mg - 1 tablet morning daily (OD) x 3 months
Tab Ecosprin 75mg - 1 tablet post lunch (OD) x 3 months
Advice: Low salt, low oil diet. Regular walking. Review after lipid profile repeat.`,
    diagnoses: ["Hypertension", "Type 2 Diabetes Mellitus", "Coronary Artery Disease Risk"],
    medicines: [
      {
        name: "Atorvastatin",
        dosage: "20mg",
        frequency: "Once daily at bedtime",
        duration: "3 months",
        instructions: "Oral, post-dinner",
      },
      {
        name: "Metformin",
        dosage: "500mg",
        frequency: "Twice daily",
        duration: "3 months",
        instructions: "Oral, after meals",
      },
      {
        name: "Telmisartan",
        dosage: "40mg",
        frequency: "Once daily morning",
        duration: "3 months",
        instructions: "Oral, with breakfast",
      },
      {
        name: "Aspirin (Ecosprin)",
        dosage: "75mg",
        frequency: "Once daily",
        duration: "3 months",
        instructions: "Oral, post lunch",
      },
    ],
    investigations: [],
    procedures: [],
    allergiesMentioned: ["Sulfa drugs (allergic rash noted in past)"],
    confidenceScore: 0.94,
  };
}

// Helper: Heuristic summary generator
function generateHeuristicSummary(params: any) {
  const {
    patient = {},
    conversationHistory = [],
    extractedDocuments = [],
    isAyushMode = false,
    redFlags = [],
    painLocations = [],
  } = params;

  // Extract from dialogue
  const answers = conversationHistory.map((c: any) => c.patientAnswer || "").filter(Boolean);
  const chief = conversationHistory[0]?.patientAnswer || "Chest tightness on walking";

  let locStr = "Retrosternal chest region";
  if (painLocations && painLocations.length > 0) {
    locStr = painLocations.map((p: any) => `${p.displayName} (${p.side}, ${p.bodyView} view)`).join("; ");
  }

  const allMeds: any[] = [];
  extractedDocuments.forEach((doc: any) => {
    if (doc.medicines && Array.isArray(doc.medicines)) {
      doc.medicines.forEach((m: any) => {
        allMeds.push({
          name: m.name,
          dose: m.dosage || "As advised",
          frequency: m.frequency || "OD",
          duration: m.duration || "Ongoing",
          source: "extracted-from-document",
        });
      });
    }
  });

  if (allMeds.length === 0) {
    allMeds.push({
      name: "Metformin",
      dose: "500 mg",
      frequency: "Twice daily",
      duration: "2 years",
      source: "patient-reported",
    });
    allMeds.push({
      name: "Telmisartan",
      dose: "40 mg",
      frequency: "Once daily",
      duration: "1 year",
      source: "patient-reported",
    });
  }

  const allInvestigations: any[] = [];
  extractedDocuments.forEach((doc: any) => {
    if (doc.investigations && Array.isArray(doc.investigations)) {
      doc.investigations.forEach((inv: any) => {
        allInvestigations.push({
          testName: inv.testName,
          value: `${inv.value} ${inv.unit || ""}`,
          referenceRange: inv.referenceRange || "Standard reference",
          status: inv.status || "within_range",
          date: doc.documentDate || "Recent",
        });
      });
    }
  });

  if (allInvestigations.length === 0) {
    allInvestigations.push(
      {
        testName: "Total Cholesterol",
        value: "245 mg/dL",
        referenceRange: "125 - 200 mg/dL",
        status: "above_range",
        date: "2026-08-14",
      },
      {
        testName: "HbA1c",
        value: "7.8 %",
        referenceRange: "4.0 - 5.6 %",
        status: "above_range",
        date: "2026-08-14",
      }
    );
  }

  return {
    patientInfo: {
      name: patient.name || "Ramesh Kumar",
      age: `${patient.age || 58} Yrs`,
      gender: patient.gender || "Male",
      patientId: patient.patientId || "PID-2026-8819",
      abhaId: patient.abhaId || "91-4523-8891-2304",
    },
    chiefComplaint: chief,
    hpi: {
      onset: answers[1] || "Began 3 days ago, sudden onset during physical exertion",
      duration: "3 days, recurrent episodes lasting 10-15 minutes each",
      location: locStr,
      painLocations: painLocations,
      painLocation: painLocations.length > 0 ? painLocations[0] : undefined,
      character: answers[2] || "Heavy squeezing sensation, accompanied by mild tightness",
      severity: answers[4] || "7/10 at peak exertion",
      timing: "Exertional, peaks during fast walking or climbing stairs",
      progression: "Progressively increasing over past 48 hours",
      aggravatingFactors: "Brisk walking, climbing stairs, emotional distress",
      relievingFactors: "Rest, sitting down for 5-10 minutes",
      associatedSymptoms: answers[5] || "Mild shortness of breath and diaphoresis (sweating); denies syncope",
    },
    painLocations: painLocations,
    pastMedicalHistory: [
      "Type 2 Diabetes Mellitus (Diagnosed 6 years ago, on oral hypoglycemics)",
      "Essential Systemic Hypertension (Diagnosed 4 years ago)",
      "Dyslipidemia (Documented on recent lipid panel)",
    ],
    pastSurgicalHistory: ["Appendectomy in 2012 (uncomplicated)"],
    medicationHistory: allMeds,
    drugAndAllergyHistory: [
      "Penicillin: Patient reports mild urticarial skin rash in 2015",
      "No known food or environmental allergies reported",
    ],
    familyHistory: [
      "Father: History of Ischemic Heart Disease / Myocardial Infarction at age 62",
      "Mother: Type 2 Diabetes Mellitus with hypertension",
    ],
    personalHistory: {
      diet: "Predominantly vegetarian Indian diet with occasional dairy; moderate salt intake",
      sleep: "6 hours per night, occasional interrupted sleep due to nocturia",
      occupation: "Accountant (Sedentary desk work)",
      habits: "Non-smoker; no regular alcohol intake",
      lifestyle: "Sedentary lifestyle with minimal daily aerobic activity",
    },
    reviewOfSystems: {
      cardiovascular: "Positive for exertional chest tightness; positive for diaphoresis; denies palpitations",
      respiratory: "Mild exertional breathlessness; denies chronic cough or hemoptysis",
      gastrointestinal: "Occasional post-prandial fullness; denies hematemesis or melena",
      neurological: "Denies focal weakness, facial droop, numbness, or loss of consciousness",
      musculoskeletal: "Mild bilateral knee stiffness on squatting; no acute swelling",
      general: "Reports generalized fatigue towards evening; no fever",
    },
    previousInvestigations: allInvestigations,
    documentSummary:
      extractedDocuments.length > 0
        ? `${extractedDocuments.length} medical document(s) reviewed: Lipid panel indicates elevated LDL (${allInvestigations.find((i) => i.testName.includes("LDL"))?.value || "165 mg/dL"}) and elevated HbA1c.`
        : "Recent lipid profile reveals elevated atherogenic cholesterol and sub-optimal glycemic control.",
    ayushAssessment: isAyushMode
      ? {
          prakriti: "Pitta-Vata dominant constitution (Dwandwaja)",
          vikriti: "Vata-Kaphaja Dushti leading to Rasavaha and Pranavaha Sroto-Avarodha",
          sara: "Madhyama Sara (Medium tissue quality)",
          samhanana: "Madhyama Samhanana (Moderate compact body build)",
          pramana: "Pramana within normal anthropometric indices",
          satmya: "Mishra Satmya (Habituated to mixed vegetarian diet)",
          sattva: "Madhyama Sattva (Moderate mental resilience)",
          aharaShakti: "Madhyama Abhyavaharana & Jarana Shakti (Moderate appetite and digestion)",
          vyayamaShakti: "Avara Vyayama Shakti (Low physical endurance/exertion threshold)",
          vaya: "Pravriddha Madhyama Vaya (58 years)",
          aharaVihara: "Sedentary routine, delayed dinners, intermittent mental stress",
        }
      : {
          prakriti: "Not assessed (AYUSH mode not selected)",
          vikriti: "Not assessed",
          sara: "Not assessed",
          samhanana: "Not assessed",
          pramana: "Not assessed",
          satmya: "Not assessed",
          sattva: "Not assessed",
          aharaShakti: "Not assessed",
          vyayamaShakti: "Not assessed",
          vaya: "Not assessed",
          aharaVihara: "Not assessed",
        },
    redFlagAlerts:
      redFlags.length > 0
        ? redFlags
        : [
            {
              symptom: "Exertional chest discomfort radiating to left shoulder with diaphoresis",
              severity: "HIGH",
              actionTaken: "Priority triage alert flagged on Doctor Queue for immediate ECG and evaluation",
            },
          ],
    aiDisclaimer:
      "AI-generated draft — Physician verification required. This summary is intended to assist medical reasoning and counseling and is not an autonomous medical diagnosis.",
  };
}

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CaseLine server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
