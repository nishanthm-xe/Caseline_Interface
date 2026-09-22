import React, { useEffect, useRef, useState } from "react";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  Info,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Keyboard,
  ShieldAlert,
  Sliders,
  Languages,
  Pause,
  Play,
  MapPin,
  Edit3,
} from "lucide-react";
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from "../data/languages";
import { fetchAdaptiveQuestion, evaluatePatientRedFlags } from "../services/apiService";
import { useLanguage } from "../context/LanguageContext";
import {
  DemographicData,
  InterviewMessage,
  RedFlagAlert,
  LanguageOption,
  AvatarMood,
  InterviewState,
  VoiceSettings,
  PainLocationItem,
} from "../types";
import { CaseLineAvatar } from "./CaseLineAvatar";
import { BodyPainLocationSelector } from "./BodyPainLocationSelector";
import { isPainComplaint, detectSuggestedRegion } from "../utils/painDetection";

const URGENT_SAFETY_MESSAGES: Record<string, string> = {
  English: "Your symptoms may need urgent medical attention. Please stay here. A healthcare staff member will assist you.",
  Hindi: "à¤†à¤ªà¤•à¥‡ à¤²à¤•à¥à¤·à¤£à¥‹à¤‚ à¤ªà¤° à¤¤à¤¤à¥à¤•à¤¾à¤² à¤šà¤¿à¤•à¤¿à¤¤à¥à¤¸à¤•à¥€à¤¯ à¤§à¥à¤¯à¤¾à¤¨ à¤¦à¥‡à¤¨à¥‡ à¤•à¥€ à¤†à¤µà¤¶à¥à¤¯à¤•à¤¤à¤¾ à¤¹à¥‹ à¤¸à¤•à¤¤à¥€ à¤¹à¥ˆà¥¤ à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¯à¤¹à¥€à¤‚ à¤°à¥à¤•à¥‡à¤‚à¥¤ à¤¸à¥à¤µà¤¾à¤¸à¥à¤¥à¥à¤¯ à¤¸à¥‡à¤µà¤¾ à¤¦à¤² à¤•à¤¾ à¤à¤• à¤¸à¤¦à¤¸à¥à¤¯ à¤†à¤ªà¤•à¥€ à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤•à¤°à¥‡à¤—à¤¾à¥¤",
  Tamil: "à®‰à®™à¯à®•à®³à¯ à®…à®±à®¿à®•à¯à®±à®¿à®•à®³à¯à®•à¯à®•à¯ à®…à®µà®šà®° à®®à®°à¯à®¤à¯à®¤à¯à®µ à®•à®µà®©à®¿à®ªà¯à®ªà¯ à®¤à¯‡à®µà¯ˆà®ªà¯à®ªà®Ÿà®²à®¾à®®à¯. à®¤à®¯à®µà¯à®šà¯†à®¯à¯à®¤à¯ à®‡à®™à¯à®•à¯‡à®¯à¯‡ à®‡à®°à¯à®™à¯à®•à®³à¯. à®šà¯à®•à®¾à®¤à®¾à®°à®ªà¯ à®ªà®£à®¿à®¯à®¾à®³à®°à¯ à®‰à®™à¯à®•à®³à¯à®•à¯à®•à¯ à®‰à®¤à®µà¯à®µà®¾à®°à¯.",
  Telugu: "à°®à±€ à°²à°•à±à°·à°£à°¾à°²à°•à± à°…à°¤à±à°¯à°µà°¸à°° à°µà±ˆà°¦à±à°¯ à°¸à°¹à°¾à°¯à°‚ à°…à°µà°¸à°°à°‚ à°•à°¾à°µà°šà±à°šà±. à°¦à°¯à°šà±‡à°¸à°¿ à°‡à°•à±à°•à°¡à±‡ à°‰à°‚à°¡à°‚à°¡à°¿. à°†à°°à±‹à°—à±à°¯ à°¸à°‚à°°à°•à±à°·à°£ à°¸à°¿à°¬à±à°¬à°‚à°¦à°¿ à°®à±€à°•à± à°¸à°¹à°¾à°¯à°‚ à°šà±‡à°¸à±à°¤à°¾à°°à±.",
  Kannada: "à²¨à²¿à²®à³à²® à²°à³‹à²—à²²à²•à³à²·à²£à²—à²³à²¿à²—à³† à²¤à³à²°à³à²¤à³ à²µà³ˆà²¦à³à²¯à²•à³€à²¯ à²šà²¿à²•à²¿à²¤à³à²¸à³†à²¯ à²…à²—à²¤à³à²¯à²µà²¿à²°à²¬à²¹à³à²¦à³. à²¦à²¯à²µà²¿à²Ÿà³à²Ÿà³ à²‡à²²à³à²²à³‡ à²‡à²°à²¿. à²†à²°à³‹à²—à³à²¯ à²¸à²¿à²¬à³à²¬à²‚à²¦à²¿ à²¨à²¿à²®à²—à³† à²¸à²¹à²¾à²¯ à²®à²¾à²¡à³à²¤à³à²¤à²¾à²°à³†.",
  Malayalam: "à´¨à´¿à´™àµà´™à´³àµà´Ÿàµ† à´²à´•àµà´·à´£à´™àµà´™àµ¾à´•àµà´•àµ à´…à´Ÿà´¿à´¯à´¨àµà´¤à´° à´µàµˆà´¦àµà´¯à´¸à´¹à´¾à´¯à´‚ à´†à´µà´¶àµà´¯à´®à´¾à´¯à´¿ à´µà´¨àµà´¨àµ‡à´•àµà´•à´¾à´‚. à´¦à´¯à´µà´¾à´¯à´¿ à´‡à´µà´¿à´Ÿàµ†à´¤àµà´¤à´¨àµà´¨àµ† à´¤àµà´Ÿà´°àµà´•. à´’à´°àµ à´†à´°àµ‹à´—àµà´¯ à´ªàµà´°à´µàµ¼à´¤àµà´¤à´•àµ» à´¨à´¿à´™àµà´™à´³àµ† à´¸à´¹à´¾à´¯à´¿à´•àµà´•àµà´‚.",
  Bengali: "à¦†à¦ªà¦¨à¦¾à¦° à¦²à¦•à§à¦·à¦£à¦—à§à¦²à¦¿à¦° à¦œà¦¨à§à¦¯ à¦…à¦¬à¦¿à¦²à¦®à§à¦¬à§‡ à¦šà¦¿à¦•à¦¿à§Žà¦¸à¦¾à¦° à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨ à¦¹à¦¤à§‡ à¦ªà¦¾à¦°à§‡à¥¤ à¦…à¦¨à§à¦—à§à¦°à¦¹ à¦•à¦°à§‡ à¦à¦–à¦¾à¦¨à§‡à¦‡ à¦¥à¦¾à¦•à§à¦¨à¥¤ à¦à¦•à¦œà¦¨ à¦¸à§à¦¬à¦¾à¦¸à§à¦¥à§à¦¯à¦•à¦°à§à¦®à§€ à¦†à¦ªà¦¨à¦¾à¦•à§‡ à¦¸à¦¾à¦¹à¦¾à¦¯à§à¦¯ à¦•à¦°à¦¬à§‡à¦¨à¥¤",
  Marathi: "à¤¤à¥à¤®à¤šà¥à¤¯à¤¾ à¤²à¤•à¥à¤·à¤£à¤¾à¤‚à¤•à¤¡à¥‡ à¤¤à¥à¤µà¤°à¤¿à¤¤ à¤µà¥ˆà¤¦à¥à¤¯à¤•à¥€à¤¯ à¤²à¤•à¥à¤· à¤¦à¥‡à¤£à¥à¤¯à¤¾à¤šà¥€ à¤†à¤µà¤¶à¥à¤¯à¤•à¤¤à¤¾ à¤…à¤¸à¥‚ à¤¶à¤•à¤¤à¥‡. à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¯à¥‡à¤¥à¥‡à¤š à¤¥à¤¾à¤‚à¤¬à¤¾. à¤†à¤°à¥‹à¤—à¥à¤¯ à¤¸à¥‡à¤µà¤¾ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤¤à¥à¤®à¥à¤¹à¤¾à¤²à¤¾ à¤®à¤¦à¤¤ à¤•à¤°à¤¤à¥€à¤².",
  Gujarati: "àª¤àª®àª¾àª°àª¾ àª²àª•à«àª·àª£à«‹ àªªàª° àª¤àª¾àª¤à«àª•àª¾àª²àª¿àª• àª¤àª¬à«€àª¬à«€ àª¸àª¾àª°àªµàª¾àª°àª¨à«€ àªœàª°à«‚àª° àªªàª¡à«€ àª¶àª•à«‡ àª›à«‡. àª•à«ƒàªªàª¾ àª•àª°à«€àª¨à«‡ àª…àª¹à«€àª‚ àªœ àª°àª¹à«‹. àª†àª°à«‹àª—à«àª¯ àª•àª°à«àª®àªšàª¾àª°à«€ àª¤àª®àª¨à«‡ àª®àª¦àª¦ àª•àª°àª¶à«‡.",
  Punjabi: "à¨¤à©à¨¹à¨¾à¨¡à©‡ à¨²à©±à¨›à¨£à¨¾à¨‚ à¨²à¨ˆ à¨¤à©à¨°à©°à¨¤ à¨¡à¨¾à¨•à¨Ÿà¨°à©€ à¨¸à¨¹à¨¾à¨‡à¨¤à¨¾ à¨¦à©€ à¨²à©‹à©œ à¨¹à©‹ à¨¸à¨•à¨¦à©€ à¨¹à©ˆà¥¤ à¨•à¨¿à¨°à¨ªà¨¾ à¨•à¨°à¨•à©‡ à¨‡à©±à¨¥à©‡ à¨¹à©€ à¨°à¨¹à©‹à¥¤ à¨‡à©±à¨• à¨¸à¨¿à¨¹à¨¤ à¨•à¨°à¨®à¨šà¨¾à¨°à©€ à¨¤à©à¨¹à¨¾à¨¡à©€ à¨®à¨¦à¨¦ à¨•à¨°à©‡à¨—à¨¾à¥¤",
  Odia: "à¬†à¬ªà¬£à¬™à­à¬• à¬²à¬•à­à¬·à¬£ à¬ªà¬¾à¬‡à¬ à¬¤à­à¬°à¬¨à­à¬¤ à¬¡à¬¾à¬•à­à¬¤à¬°à­€ à¬¸à¬¹à¬¾à­Ÿà¬¤à¬¾ à¬†à¬¬à¬¶à­à­Ÿà¬• à¬¹à­‹à¬‡à¬ªà¬¾à¬°à­‡à¥¤ à¬¦à­Ÿà¬¾à¬•à¬°à¬¿ à¬à¬ à¬¾à¬°à­‡ à¬°à­à¬¹à¬¨à­à¬¤à­à¥¤ à¬œà¬£à­‡ à¬¸à­à­±à¬¾à¬¸à­à¬¥à­à­Ÿà¬•à¬°à­à¬®à­€ à¬†à¬ªà¬£à¬™à­à¬•à­ à¬¸à¬¾à¬¹à¬¾à¬¯à­à­Ÿ à¬•à¬°à¬¿à¬¬à­‡à¥¤",
  Assamese: "à¦†à¦ªà§‹à¦¨à¦¾à§° à¦²à¦•à§à¦·à¦£à¦¸à¦®à§‚à¦¹à§° à¦¬à¦¾à¦¬à§‡ à¦œà§°à§à§°à§€ à¦šà¦¿à¦•à¦¿à§Žà¦¸à¦¾ à¦¸à§‡à§±à¦¾à§° à¦ªà§à§°à¦¯à¦¼à§‹à¦œà¦¨ à¦¹'à¦¬ à¦ªà¦¾à§°à§‡à¥¤ à¦…à¦¨à§à¦—à§à§°à¦¹ à¦•à§°à¦¿ à¦‡à¦¯à¦¼à¦¾à¦¤à§‡à¦‡ à¦¥à¦¾à¦•à¦•à¥¤ à¦à¦—à§°à¦¾à¦•à§€ à¦¸à§à¦¬à¦¾à¦¸à§à¦¥à§à¦¯à¦•à§°à§à¦®à§€à¦¯à¦¼à§‡ à¦†à¦ªà§‹à¦¨à¦¾à¦• à¦¸à¦¹à¦¾à¦¯à¦¼ à¦•à§°à¦¿à¦¬à¥¤",
  Urdu: "Ø¢Ù¾ Ú©ÛŒ Ø¹Ù„Ø§Ù…Ø§Øª Ù¾Ø± ÙÙˆØ±ÛŒ Ø·Ø¨ÛŒ ØªÙˆØ¬Û Ú©ÛŒ Ø¶Ø±ÙˆØ±Øª ÛÙˆ Ø³Ú©ØªÛŒ ÛÛ’Û” Ø¨Ø±Ø§Û Ú©Ø±Ù… ÛŒÛÛŒÚº Ø±ÛÛŒÚºÛ” ØµØ­Øª Ú©Ø§ Ø¹Ù…Ù„Û Ø¢Ù¾ Ú©ÛŒ Ù…Ø¯Ø¯ Ú©Ø±Û’ Ú¯Ø§Û”",
};

const BODY_PROMPT_PHRASES: Record<string, string> = {
  English: "Please show me exactly where you feel the pain.",
  Hindi: "à¤•à¥ƒà¤ªà¤¯à¤¾ à¤®à¥à¤à¥‡ à¤¶à¤°à¥€à¤° à¤•à¥‡ à¤šà¤¿à¤¤à¥à¤° à¤ªà¤° à¤ à¥€à¤• à¤µà¤¹à¥€ à¤œà¤—à¤¹ à¤¦à¤¿à¤–à¤¾à¤à¤‚ à¤œà¤¹à¤¾à¤ à¤†à¤ªà¤•à¥‹ à¤¦à¤°à¥à¤¦ à¤®à¤¹à¤¸à¥‚à¤¸ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆà¥¤",
  Tamil: "à®¤à®¯à®µà¯à®šà¯†à®¯à¯à®¤à¯ à®‰à®™à¯à®•à®³à¯à®•à¯à®•à¯ à®µà®²à®¿ à®Žà®™à¯à®•à¯à®³à¯à®³à®¤à¯ à®Žà®©à¯à®ªà®¤à¯ˆ à®šà®°à®¿à®¯à®¾à®•à®•à¯ à®•à®¾à®Ÿà¯à®Ÿà¯à®™à¯à®•à®³à¯.",
  Telugu: "à°¦à°¯à°šà±‡à°¸à°¿ à°®à±€à°•à± à°Žà°•à±à°•à°¡ à°¨à±Šà°ªà±à°ªà°¿ à°‰à°‚à°¦à±‹ à°¶à°°à±€à°° à°šà°¿à°¤à±à°°à°‚à°ªà±ˆ à°–à°šà±à°šà°¿à°¤à°‚à°—à°¾ à°šà±‚à°ªà°¿à°‚à°šà°‚à°¡à°¿.",
  Kannada: "à²¦à²¯à²µà²¿à²Ÿà³à²Ÿà³ à²¨à²¿à²®à²—à³† à²Žà²²à³à²²à²¿ à²¨à³‹à²µà³ à²‡à²¦à³† à²Žà²‚à²¦à³ à²¨à²¿à²–à²°à²µà²¾à²—à²¿ à²¤à³‹à²°à²¿à²¸à²¿.",
  Malayalam: "à´¨à´¿à´™àµà´™àµ¾à´•àµà´•àµ à´Žà´µà´¿à´Ÿàµ†à´¯à´¾à´£àµ à´µàµ‡à´¦à´¨ à´…à´¨àµà´­à´µà´ªàµà´ªàµ†à´Ÿàµà´¨àµà´¨à´¤àµ†à´¨àµà´¨àµ à´¦à´¯à´µà´¾à´¯à´¿ à´•àµƒà´¤àµà´¯à´®à´¾à´¯à´¿ à´•à´¾à´£à´¿à´•àµà´•àµà´•.",
  Bengali: "à¦…à¦¨à§à¦—à§à¦°à¦¹ à¦•à¦°à§‡ à¦¶à¦°à§€à¦°à§‡à¦° à¦šà¦¿à¦¤à§à¦°à§‡ à¦¦à§‡à¦–à¦¾à¦¨ à¦†à¦ªà¦¨à¦¾à¦° à¦ à¦¿à¦• à¦•à§‹à¦¥à¦¾à¦¯à¦¼ à¦¬à§à¦¯à¦¥à¦¾ à¦¹à¦šà§à¦›à§‡à¥¤",
  Marathi: "à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¶à¤°à¥€à¤°à¤¾à¤šà¥à¤¯à¤¾ à¤šà¤¿à¤¤à¥à¤°à¤¾à¤µà¤° à¤¦à¤¾à¤–à¤µà¤¾ à¤¤à¥à¤®à¥à¤¹à¤¾à¤²à¤¾ à¤¨à¤•à¥à¤•à¥€ à¤•à¥à¤ à¥‡ à¤¦à¥à¤–à¤¤ à¤†à¤¹à¥‡.",
  Gujarati: "àª•à«ƒàªªàª¾ àª•àª°à«€àª¨à«‡ àª®àª¨à«‡ àª¶àª°à«€àª° àªªàª° àª¬àª°àª¾àª¬àª° àª¬àª¤àª¾àªµà«‹ àª•à«‡ àª¤àª®àª¨à«‡ àª•à«àª¯àª¾àª‚ àª¦à«àª–àª¾àªµà«‹ àª¥àª¾àª¯ àª›à«‡.",
  Punjabi: "à¨•à¨¿à¨°à¨ªà¨¾ à¨•à¨°à¨•à©‡ à¨®à©ˆà¨¨à©‚à©° à¨¸à¨°à©€à¨° 'à¨¤à©‡ à¨¬à¨¿à¨²à¨•à©à¨² à¨¦à¨¿à¨–à¨¾à¨“ à¨•à¨¿ à¨¤à©à¨¹à¨¾à¨¨à©‚à©° à¨•à¨¿à©±à¨¥à©‡ à¨¦à¨°à¨¦ à¨¹à©‹ à¨°à¨¿à¨¹à¨¾ à¨¹à©ˆà¥¤",
  Odia: "à¬¦à­Ÿà¬¾à¬•à¬°à¬¿ à¬¶à¬°à­€à¬°à¬°à­‡ à¬¦à­‡à¬–à¬¾à¬¨à­à¬¤à­ à¬†à¬ªà¬£à¬™à­à¬•à­ à¬ à¬¿à¬•à­ à¬•à­‡à¬‰à¬à¬ à¬¾à¬°à­‡ à¬¯à¬¨à­à¬¤à­à¬°à¬£à¬¾ à¬¹à­‡à¬‰à¬›à¬¿à¥¤",
  Assamese: "à¦…à¦¨à§à¦—à§à§°à¦¹ à¦•à§°à¦¿ à¦¶à§°à§€à§°à¦¤ à¦¦à§‡à¦–à§à§±à¦¾à¦“à¦• à¦†à¦ªà§‹à¦¨à¦¾à§° à¦ à¦¿à¦• à¦•'à¦¤ à¦¬à¦¿à¦· à¦¹à§ˆà¦›à§‡à¥¤",
  Urdu: "Ø¨Ø±Ø§Û Ú©Ø±Ù… Ù…Ø¬Ú¾Û’ Ø¨Ø§Ù„Ú©Ù„ Ø¯Ú©Ú¾Ø§Ø¦ÛŒÚº Ú©Û Ø¢Ù¾ Ú©Ùˆ Ú©ÛØ§Úº Ø¯Ø±Ø¯ ÛÙˆ Ø±ÛØ§ ÛÛ’Û”",
};

const getPainAckPhrase = (lang: string, locationNames: string) => {
  switch (lang) {
    case "Hindi":
      return `à¤®à¥ˆà¤‚à¤¨à¥‡ à¤†à¤ªà¤•à¥‡ ${locationNames} à¤•à¥‡ à¤¦à¤°à¥à¤¦ à¤•à¥‹ à¤¨à¥‹à¤Ÿ à¤•à¤° à¤²à¤¿à¤¯à¤¾ à¤¹à¥ˆà¥¤ à¤†à¤‡à¤ à¤‡à¤¸à¤•à¥‡ à¤¬à¤¾à¤°à¥‡ à¤®à¥‡à¤‚ à¤µà¤¿à¤¸à¥à¤¤à¤¾à¤° à¤¸à¥‡ à¤¸à¤®à¤à¥‡à¤‚à¥¤`;
    case "Tamil":
      return `à®‰à®™à¯à®•à®³à¯ ${locationNames} à®ªà®•à¯à®¤à®¿à®¯à®¿à®²à¯ à®‰à®³à¯à®³ à®µà®²à®¿à®¯à¯ˆ à®•à¯à®±à®¿à®¤à¯à®¤à¯à®•à¯ à®•à¯Šà®£à¯à®Ÿà¯‡à®©à¯. à®‡à®¤à¯ˆà®ªà¯ à®ªà®±à¯à®±à®¿ à®šà®¿à®² à®µà®¿à®µà®°à®™à¯à®•à®³à¯ˆ à®…à®±à®¿à®¨à¯à®¤à¯ à®•à¯Šà®³à¯à®µà¯‹à®®à¯.`;
    case "Telugu":
      return `à°®à±€ ${locationNames} à°µà°¦à±à°¦ à°‰à°¨à±à°¨ à°¨à±Šà°ªà±à°ªà°¿à°¨à°¿ à°¨à±‡à°¨à± à°—à±à°°à±à°¤à°¿à°‚à°šà°¾à°¨à±. à°¦à±€à°¨à°¿ à°—à±à°°à°¿à°‚à°šà°¿ à°®à°°à°¿à°¨à±à°¨à°¿ à°µà°¿à°µà°°à°¾à°²à± à°¤à±†à°²à±à°¸à±à°•à±à°‚à°¦à°¾à°‚.`;
    case "Kannada":
      return `à²¨à²¿à²®à³à²® ${locationNames} à²¨à³‹à²µà²¨à³à²¨à³ à²¨à²¾à²¨à³ à²—à³à²°à³à²¤à²¿à²¸à²¿à²¦à³à²¦à³‡à²¨à³†. à²‡à²¦à²° à²¬à²—à³à²—à³† à²¹à³†à²šà³à²šà²¿à²¨ à²µà²¿à²µà²°à²—à²³à²¨à³à²¨à³ à²¤à²¿à²³à²¿à²¯à³‹à²£.`;
    case "Malayalam":
      return `à´¨à´¿à´™àµà´™à´³àµà´Ÿàµ† ${locationNames} à´­à´¾à´—à´¤àµà´¤àµ† à´µàµ‡à´¦à´¨ à´žà´¾àµ» à´°àµ‡à´–à´ªàµà´ªàµ†à´Ÿàµà´¤àµà´¤à´¿à´¯à´¿à´Ÿàµà´Ÿàµà´£àµà´Ÿàµ. à´‡à´¤à´¿à´¨àµ†à´•àµà´•àµà´±à´¿à´šàµà´šàµ à´•àµ‚à´Ÿàµà´¤àµ½ à´®à´¨à´¸àµà´¸à´¿à´²à´¾à´•àµà´•à´¾à´‚.`;
    case "Bengali":
      return `à¦†à¦®à¦¿ à¦†à¦ªà¦¨à¦¾à¦° ${locationNames}-à¦à¦° à¦¬à§à¦¯à¦¥à¦¾à¦° à¦¸à§à¦¥à¦¾à¦¨ à¦šà¦¿à¦¹à§à¦¨à¦¿à¦¤ à¦•à¦°à§‡à¦›à¦¿à¥¤ à¦†à¦¸à§à¦¨ à¦à¦° à¦¬à¦¿à¦¶à¦¦ à¦œà§‡à¦¨à§‡ à¦¨à¦¿à¦‡à¥¤`;
    case "Marathi":
      return `à¤®à¥€ à¤¤à¥à¤®à¤šà¥à¤¯à¤¾ ${locationNames} à¤®à¤§à¥€à¤² à¤µà¥‡à¤¦à¤¨à¤¾à¤‚à¤šà¥€ à¤¨à¥‹à¤‚à¤¦ à¤˜à¥‡à¤¤à¤²à¥€ à¤†à¤¹à¥‡. à¤¯à¤¾à¤¬à¤¦à¥à¤¦à¤² à¤…à¤§à¤¿à¤• à¤®à¤¾à¤¹à¤¿à¤¤à¥€ à¤œà¤¾à¤£à¥‚à¤¨ à¤˜à¥‡à¤Šà¤¯à¤¾.`;
    case "Gujarati":
      return `àª®à«‡àª‚ àª¤àª®àª¾àª°àª¾ ${locationNames}àª¨àª¾ àª¦à«àª–àª¾àªµàª¾àª¨à«€ àª¨à«‹àª‚àª§ àª²à«€àª§à«€ àª›à«‡. àªšàª¾àª²à«‹ àª† àªµàª¿àª¶à«‡ àªµàª¿àª—àª¤àªµàª¾àª° àª¸àª®àªœà«€àª.`;
    case "Punjabi":
      return `à¨®à©ˆà¨‚ à¨¤à©à¨¹à¨¾à¨¡à©‡ ${locationNames} à¨¦à©‡ à¨¦à¨°à¨¦ à¨¨à©‚à©° à¨¦à¨°à¨œ à¨•à¨° à¨²à¨¿à¨† à¨¹à©ˆà¥¤ à¨†à¨“ à¨‡à¨¸ à¨¬à¨¾à¨°à©‡ à¨¹à©‹à¨° à¨œà¨¾à¨£à©€à¨à¥¤`;
    case "Odia":
      return `à¬®à­à¬ à¬†à¬ªà¬£à¬™à­à¬•à¬° ${locationNames} à¬¯à¬¨à­à¬¤à­à¬°à¬£à¬¾ à¬¸à­à¬¥à¬¾à¬¨ à¬Ÿà¬¿à¬ªà¬¿ à¬°à¬–à¬¿à¬›à¬¿à¥¤ à¬ à¬¬à¬¿à¬·à­Ÿà¬°à­‡ à¬…à¬§à¬¿à¬• à¬œà¬¾à¬£à¬¿à¬¬à¬¾à¥¤`;
    case "Assamese":
      return `à¦®à¦‡ à¦†à¦ªà§‹à¦¨à¦¾à§° ${locationNames}à§° à¦¬à¦¿à¦·à§° à¦¸à§à¦¥à¦¾à¦¨ à¦Ÿà§à¦•à¦¿ à¦²à§ˆà¦›à§‹à¦à¥¤ à¦†à¦¹à¦• à¦à¦‡ à¦¬à¦¿à¦·à§Ÿà§‡ à¦†à§°à§ à¦¬à§à¦œà¦¿ à¦²à¦“à¦à¥¤`;
    case "Urdu":
      return `Ù…ÛŒÚº Ù†Û’ Ø¢Ù¾ Ú©Û’ ${locationNames} Ú©Û’ Ø¯Ø±Ø¯ Ú©Ùˆ Ù†ÙˆÙ¹ Ú©Ø± Ù„ÛŒØ§ ÛÛ’Û” Ø¢Ø¦ÛŒÛ’ Ø§Ø³ Ú©Û’ Ø¨Ø§Ø±Û’ Ù…ÛŒÚº ØªÙØµÛŒÙ„ Ø¬Ø§Ù†ÛŒÚºÛ”`;
    default:
      return `I see, your ${locationNames}. Let me ask a few details about this area.`;
  }
};

interface VoiceHealthInterviewScreenProps {
  patient: DemographicData;
  selectedLanguage: LanguageOption;
  isAyushMode: boolean;
  character?: "female" | "male";
  voiceSettings?: VoiceSettings;
  initialPainLocations?: PainLocationItem[];
  onToggleAyushMode: () => void;
  onInterviewComplete: (
    messages: InterviewMessage[],
    redFlags: RedFlagAlert[],
    painLocations?: PainLocationItem[]
  ) => void;
  onTriggerSos: () => void;
  onBackToDashboard: () => void;
  onOpenVoiceSettings?: () => void;
}

export const VoiceHealthInterviewScreen: React.FC<VoiceHealthInterviewScreenProps> = ({
  patient,
  selectedLanguage,
  isAyushMode,
  character = "female",
  voiceSettings,
  initialPainLocations = [],
  onToggleAyushMode,
  onInterviewComplete,
  onTriggerSos,
  onBackToDashboard,
  onOpenVoiceSettings,
}) => {
  const { t: translate, selectedLocale, selectedVoiceLocale } = useLanguage();
  const [messages, setMessages] = useState<InterviewMessage[]>([]);


  const [currentQuestion, setCurrentQuestion] = useState<{
    textInLang: string;
    textInEng: string;
    category: string;
    options: string[];
    isRedFlag: boolean;
    redFlagReason?: string;
    redFlagAdvice?: string;
    rationale?: string;
  } | null>(null);

  // Real-time interview state driving avatar animation and expressions ('READY', 'LISTENING', 'PROCESSING', 'SPEAKING', 'ERROR')
  const [interviewState, setInterviewState] = useState<InterviewState>("READY");
  const voiceState = interviewState;
  const setVoiceState = (state: InterviewState | "IDLE" | "REQUESTING_MICROPHONE" | "TRANSCRIBING") => {
    if (state === "IDLE") setInterviewState("READY");
    else if (state === "REQUESTING_MICROPHONE" || state === "TRANSCRIBING") setInterviewState("LISTENING");
    else setInterviewState(state);
  };

  const [typedInput, setTypedInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [activeRedFlags, setActiveRedFlags] = useState<RedFlagAlert[]>([]);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [urgentSafetyAlert, setUrgentSafetyAlert] = useState<{
    displayTitle: string;
    advice: string;
    reason: string;
    patientStatement: string;
    matchedRules: string[];
    timestamp: string;
  } | null>(null);
  const [priorityTriageNotice, setPriorityTriageNotice] = useState<string | null>(null);
  const [waveformLevels, setWaveformLevels] = useState<number[]>([
    20, 45, 75, 30, 60, 85, 40, 65, 35, 90, 50, 30,
  ]);

  // Body Pain Location Interactive State
  const [confirmedPainLocations, setConfirmedPainLocations] = useState<PainLocationItem[]>(initialPainLocations);
  const [showBodySelector, setShowBodySelector] = useState<boolean>(false);
  const [suggestedPainArea, setSuggestedPainArea] = useState<string>("");
  const [hasPromptedPainLocation, setHasPromptedPainLocation] = useState<boolean>(initialPainLocations.length > 0);

  // Track active speech synthesis request to synchronize avatar state
  const [speechRequest, setSpeechRequest] = useState<{
    text: string;
    id: number;
  } | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const t =
    TRANSLATIONS[selectedLanguage.name] ||
    TRANSLATIONS[selectedLanguage.code] ||
    TRANSLATIONS["English"];

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Map interviewState (READY, LISTENING, PROCESSING, SPEAKING, ERROR) to AvatarMood
  const getAvatarMood = (): AvatarMood => {
    switch (interviewState) {
      case "LISTENING":
        return "LISTENING";
      case "PROCESSING":
        return "PROCESSING";
      case "SPEAKING":
        return "SPEAKING";
      case "ERROR":
        return "ERROR";
      case "READY":
      default:
        return "IDLE";
    }
  };

  // Simulate audio waveform animation when listening or speaking
  useEffect(() => {
    if (interviewState === "LISTENING" || interviewState === "SPEAKING") {
      const interval = setInterval(() => {
        setWaveformLevels(
          Array.from({ length: 14 }, () => Math.floor(Math.random() * 75) + 15)
        );
      }, 100);
      return () => clearInterval(interval);
    } else {
      setWaveformLevels([15, 20, 15, 25, 18, 15, 22, 16, 20, 15, 18, 15, 16, 15]);
    }
  }, [interviewState]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, currentQuestion]);

  // Initial question load
  useEffect(() => {
    loadNextQuestion([]);
  }, [selectedLanguage.code, isAyushMode]);

  // useEffect: updates interviewState to 'SPEAKING' when text-to-speech output triggers,
  // and automatically returns to 'READY' (idle) when audio playback completes.
  useEffect(() => {
    if (!speechRequest?.text) {
      return;
    }

    if (!("speechSynthesis" in window)) {
      setInterviewState("READY");
      return;
    }

    // Cancel any previous speech output to prevent overlap
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(speechRequest.text);
    utteranceRef.current = utterance;
    utterance.lang = selectedLanguage.ttsLang || "en-IN";
    utterance.rate = voiceSettings?.rate || 0.92;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(
      (v) =>
        v.lang.startsWith(selectedLanguage.code) &&
        (character === "female"
          ? v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("zira") ||
            v.name.toLowerCase().includes("natural")
          : v.name.toLowerCase().includes("male") ||
            v.name.toLowerCase().includes("david"))
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    // Transition state to 'SPEAKING' when audio playback starts
    utterance.onstart = () => {
      setInterviewState("SPEAKING");
    };

    // Automatically return to 'READY' (idle) when audio playback completes
    utterance.onend = () => {
      setInterviewState("READY");
      utteranceRef.current = null;
    };

    // Automatically return to 'READY' (idle) if audio playback errors or is cancelled
    utterance.onerror = (e) => {
      console.warn("Text-to-speech audio playback interrupted or encountered error:", e);
      setInterviewState("READY");
      utteranceRef.current = null;
    };

    // Watchdog check for browsers where onend might not fire reliably
    const watchdogTimer = window.setInterval(() => {
      if (!window.speechSynthesis.speaking && interviewState === "SPEAKING") {
        setInterviewState("READY");
      }
    }, 150);

    window.speechSynthesis.speak(utterance);

    // Cleanup: cancel speech synthesis and restore interviewState to 'READY'
    return () => {
      window.clearInterval(watchdogTimer);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setInterviewState("READY");
    };
  }, [speechRequest, selectedLanguage.ttsLang]);

  // TTS playback initiator
  const speakText = (text: string) => {
    if (!text) return;
    setSpeechRequest({ text, id: Date.now() });
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechRequest(null);
    setInterviewState("READY");
  };

  // Gemini API microphone STT
  const startSpeechRecognition = async () => {
    setSpeechError(null);
    stopSpeaking();
    setInterviewState("LISTENING");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];

      const supportedMimeType =
        mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ||
        "";

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setInterviewState("ERROR");
        setSpeechError(
          translate(
            "interview.micError",
            "Microphone input failed. Please try again."
          )
        );
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (chunks.length === 0) {
          setInterviewState("ERROR");
          setSpeechError(
            translate(
              "interview.micError",
              "No audio was captured. Please try speaking again."
            )
          );
          return;
        }

        try {
          setInterviewState("PROCESSING");

          const audioBlob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });

          const arrayBuffer = await audioBlob.arrayBuffer();

          let binary = "";
          const bytes = new Uint8Array(arrayBuffer);
          const chunkSize = 0x8000;

          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(
              ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
            );
          }

          const audioBase64 = btoa(binary);

          const response = await fetch("/api/ai/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              audioBase64,
              mimeType: audioBlob.type || "audio/webm",
              language:
                selectedLanguage.name ||
                selectedLanguage.locale ||
                "English",
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result?.error || "Audio transcription failed."
            );
          }

          const transcript = String(result?.transcript || "").trim();

          if (!transcript) {
            throw new Error("Gemini returned an empty transcription.");
          }

          setTypedInput(transcript);

          // Keep the existing adaptive-questioning pipeline.
          await handleAnswer(transcript, "voice");
        } catch (error: any) {
          console.error("Gemini voice transcription error:", error);
          setInterviewState("ERROR");
          setSpeechError(
            error?.message ||
              translate(
                "interview.micError",
                "Voice processing failed. Please try again or type your answer."
              )
          );
          setShowTextInput(true);
        }
      };

      recognitionRef.current = recorder;

      recorder.start();

      console.log(
        "CASE LINE Gemini microphone recording started:",
        recorder.mimeType
      );
    } catch (error: any) {
      console.error("Could not start Gemini microphone:", error);

      setInterviewState("ERROR");

      if (
        error?.name === "NotAllowedError" ||
        error?.name === "PermissionDeniedError"
      ) {
        setSpeechError(
          translate(
            "interview.micDenied",
            "Microphone permission was denied. Please allow microphone access in your browser."
          )
        );
      } else {
        setSpeechError(
          error?.message ||
            translate(
              "interview.micError",
              "Could not start microphone. Please try again."
            )
        );
      }

      setShowTextInput(true);
    }
  };

  const stopSpeechRecognition = () => {
    const recorder = recognitionRef.current;

    if (recorder) {
      try {
        if (recorder.state === "recording") {
          recorder.stop();
          return;
        }
      } catch (e) {
        console.warn("Error stopping microphone recorder:", e);
      }
    }

    if (interviewState !== "PROCESSING") {
      setInterviewState("READY");
    }
  };
  // Load next clinical question via backend /api/ai/question
  const loadNextQuestion = async (
    conversation: InterviewMessage[],
    overridePainLocations?: PainLocationItem[]
  ) => {
    setInterviewState("PROCESSING");
    try {
      const chief =
        conversation.find((m) => m.category === "Chief Complaint")?.text || "";

      const historyPayload = conversation.map((m) => ({
        question: m.sender === "ai" ? m.text : undefined,
        patientAnswer: m.sender === "patient" ? m.text : undefined,
        category: m.category,
      }));

      const activePainLocations = overridePainLocations || confirmedPainLocations;

      const result = await fetchAdaptiveQuestion({
        language: selectedLanguage.name,
        selectedLanguage: selectedLanguage.name,
        selectedLocale: selectedLanguage.locale || selectedLocale,
        selectedVoiceLocale: selectedLanguage.ttsLang || selectedVoiceLocale,
        chiefComplaint: chief,
        conversationHistory: historyPayload,
        patientProfile: patient,
        isAyushMode,
        currentStep: conversation.length,
        painLocations: activePainLocations,
      });

      if (result) {
        if (result.isInterviewComplete && conversation.length >= 4) {
          onInterviewComplete(conversation, activeRedFlags, activePainLocations);
          return;
        }

        const qData = {
          textInLang: result.nextQuestion || result.questionInLanguage || result.patientMessage,
          textInEng: result.questionInEnglish,
          category: result.clinicalCategory || "Clinical Intake",
          options: result.touchOptions || [
            "Yes, definitely",
            "Mild / Occasionally",
            "No, not experienced",
            "Not sure",
          ],
          isRedFlag: !!result.isRedFlag,
          redFlagReason: result.redFlagReason,
          redFlagAdvice: result.redFlagEmergencyAdvice,
          rationale: result.questionWhy || result.clinicalRationale,
        };


        setCurrentQuestion(qData);

        const newMsg: InterviewMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          category: qData.category,
          text: qData.textInLang,
          textInEnglish: qData.textInEng,
          touchOptions: qData.options,
          rationale: qData.rationale,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          source: "ai",
        };

        setMessages((prev) => [...prev, newMsg]);

        // Automatically speak aloud question if autoSpeak is enabled
        if (voiceSettings?.autoSpeak !== false) {
          speakText(qData.textInLang);
        }

        // Check red-flag alert
        if (result.isRedFlag) {
          const newFlag: RedFlagAlert = {
            symptom:
              result.redFlagReason ||
              "Potential acute cardiopulmonary condition reported",
            severity: "HIGH",
            actionTaken:
              "Emergency red-flag banner displayed and hospital priority triage alerted.",
            detectedAt: new Date().toLocaleTimeString(),
          };
          setActiveRedFlags((prev) => [...prev, newFlag]);
        }
      }
    } catch (e) {
      console.error("Error loading question:", e);
      setInterviewState("ERROR");
    }
  };

  // Handle confirmation of locations from Body Pain Location Selector
  const handleConfirmBodyLocations = (locations: PainLocationItem[]) => {
    setShowBodySelector(false);
    setConfirmedPainLocations(locations);

    if (locations.length > 0) {
      const locNames = locations.map((l) => l.displayName).join(", ");
      const ackText = getPainAckPhrase(selectedLanguage.name, locNames);
      const ackMsg: InterviewMessage = {
        id: `ai-ack-${Date.now()}`,
        sender: "ai",
        category: "Pain Location",
        text: ackText,
        textInEnglish: `I see, your ${locNames}. Let me ask a few details about this area.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        source: "ai",
      };

      const updatedWithAck = [...messages, ackMsg];
      setMessages(updatedWithAck);
      speakText(ackText);
      loadNextQuestion(updatedWithAck, locations);
    } else {
      loadNextQuestion(messages);
    }
  };

  const handleCloseBodySelector = () => {
    setShowBodySelector(false);
    loadNextQuestion(messages);
  };

  // Submit patient answer
  const handleAnswer = async (
    answerText: string,
    source: "touch" | "voice" | "text"
  ) => {
    if (!answerText.trim()) return;

    stopSpeaking();
    stopSpeechRecognition();
    setTypedInput("");
    setInterviewState("PROCESSING");

    const patientMsg: InterviewMessage = {
      id: `pat-${Date.now()}`,
      sender: "patient",
      category: currentQuestion?.category,
      text: answerText,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      source,
    };

    const updated = [...messages, patientMsg];
    setMessages(updated);

    // Call real-time red-flag evaluation engine
    try {
      const redFlagResult = await evaluatePatientRedFlags({
        text: answerText,
        language: selectedLanguage.name,
        conversationHistory: updated,
        patient,
        source: source === "voice" ? "voice" : "text",
      });

      if (redFlagResult.level === "URGENT") {
        const localizedSafety =
          translate(
            "emergency.urgentNotice",
            URGENT_SAFETY_MESSAGES[selectedLanguage.name] ||
            URGENT_SAFETY_MESSAGES["English"]
          );


        const flag: RedFlagAlert = {
          id: `FLAG-${Date.now()}`,
          symptom: redFlagResult.staffAlertReason || `Potential urgent symptom: "${answerText}"`,
          severity: "CRITICAL",
          actionTaken: "Hospital triage alert dispatched. Routine questions paused.",
          detectedAt: new Date().toLocaleTimeString(),
        };
        setActiveRedFlags((prev) => [flag, ...prev]);

        setUrgentSafetyAlert({
          displayTitle: redFlagResult.displayTitle || "Potential urgent symptom pattern detected.",
          advice: localizedSafety,
          reason: redFlagResult.staffAlertReason || "Concerning symptom reported",
          patientStatement: answerText,
          matchedRules: redFlagResult.matchedRules || [],
          timestamp: new Date().toLocaleTimeString(),
        });

        // Avatar calmly speaks safety message
        speakText(localizedSafety);
        setInterviewState("READY");
        return; // Routine intake paused
      } else if (redFlagResult.level === "PRIORITY") {
        const flag: RedFlagAlert = {
          id: `FLAG-${Date.now()}`,
          symptom: redFlagResult.staffAlertReason || `Concerning symptom: "${answerText}"`,
          severity: "HIGH",
          actionTaken: "Triage staff notified for priority OPD queueing.",
          detectedAt: new Date().toLocaleTimeString(),
        };
        setActiveRedFlags((prev) => [flag, ...prev]);
        setPriorityTriageNotice(redFlagResult.staffAlertReason || "Priority triage alert logged for clinical team.");
      }
    } catch (evalErr) {
      console.warn("Red flag evaluation fallback:", evalErr);
    }

    // Pain detection check:
    // If patient describes pain / discomfort in a body area and body selector hasn't opened yet:
    const painDetected = isPainComplaint(answerText);
    if (painDetected && confirmedPainLocations.length === 0 && !hasPromptedPainLocation) {
      setHasPromptedPainLocation(true);
      setSuggestedPainArea(answerText);
      const promptText =
        translate(
          "interview.promptPainLocation",
          BODY_PROMPT_PHRASES[selectedLanguage.name] ||
          BODY_PROMPT_PHRASES["English"]
        );


      // Add AI prompt to conversation

      const aiPromptMsg: InterviewMessage = {
        id: `ai-prompt-${Date.now()}`,
        sender: "ai",
        category: "Pain Location",
        text: promptText,
        textInEnglish: "Please show me exactly where you feel the pain.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        source: "ai",
      };

      setMessages([...updated, aiPromptMsg]);
      speakText(promptText);
      setShowBodySelector(true);
      return;
    }

    // Load next question or wrap up
    loadNextQuestion(updated);
  };

  return (
    <div
      id="voice-health-interview-screen"
      className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-20"
    >
      {/* Top Controls Bar with Exact Breadcrumb */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            â† Back
          </button>
          <div>
            <div className="text-xs font-bold text-slate-400">
              Patient <span className="text-slate-300">/</span>{" "}
              <span className="text-sky-700 font-extrabold">Interview</span>
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {patient.name} ({patient.age}y/{patient.gender}) â€¢ ID:{" "}
              {patient.patientId}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Regional Spoken Language Badge / Shortcut to Voice Settings */}
          {onOpenVoiceSettings ? (
            <button
              type="button"
              id="interview-active-language-btn"
              onClick={onOpenVoiceSettings}
              title="Change regional spoken language & voice settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
            >
              <Languages className="w-3.5 h-3.5 text-sky-600 group-hover:scale-110 transition-transform" />
              <span>{selectedLanguage.name} ({selectedLanguage.nativeName})</span>
              <Sliders className="w-3 h-3 text-sky-500 ml-0.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold">
              <Languages className="w-3.5 h-3.5 text-sky-600" />
              <span>{selectedLanguage.name} ({selectedLanguage.nativeName})</span>
            </div>
          )}

          {/* AYUSH Mode Toggle */}
          <button
            type="button"
            onClick={onToggleAyushMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isAyushMode
                ? "bg-amber-100 border-amber-300 text-amber-900 shadow-2xs"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title="Toggle Ayurvedic Prakriti & Agni intake"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-700" />
            <span>{isAyushMode ? "ðŸŒ¿ AYUSH Active" : "AYUSH Mode"}</span>
          </button>

          {/* Emergency SOS Button */}
          <button
            type="button"
            onClick={onTriggerSos}
            className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
            <span>SOS</span>
          </button>
        </div>
      </div>

      {/* Progress Indicator: Question X of 7 */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-2xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-extrabold">
          <span className="text-sky-800">
            Question {Math.min(messages.filter((m) => m.sender === "patient").length + 1, 7)} of 7
          </span>
          <span className="text-slate-400 font-semibold">
            {Math.round((Math.min(messages.filter((m) => m.sender === "patient").length + 1, 7) / 7) * 100)}% Completed
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-300"
            style={{
              width: `${(Math.min(messages.filter((m) => m.sender === "patient").length + 1, 7) / 7) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Priority Triage Notice Banner */}
      {priorityTriageNotice && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs font-semibold text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{priorityTriageNotice}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-amber-200/70 rounded-full text-amber-900 shrink-0">
            Priority Queue Assigned
          </span>
        </div>
      )}

      {/* Red-Flag Urgent Banner */}
      {activeRedFlags.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-start justify-between gap-3 animate-pulse">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-extrabold text-rose-900">
                {t.emergencyAlertTitle || "Potential Red-Flag Alert"}
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                {activeRedFlags[0].symptom}. Please notify hospital nursing staff
                immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTriggerSos}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs shrink-0 cursor-pointer"
          >
            Open Emergency SOS
          </button>
        </div>
      )}

      {/* 2-Column Responsive Layout (LEFT: Avatar & Voice/Touch | RIGHT: Chat & Context) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT / MAIN (7 Columns on large screen) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Question Card with Persistent CASE LINE Avatar */}
          <div
            className={`bg-white rounded-3xl p-5 sm:p-6 border shadow-md relative overflow-hidden flex flex-col items-center text-center transition-all duration-500 ${
              voiceState === "LISTENING"
                ? "border-sky-300 shadow-sky-100"
                : voiceState === "SPEAKING"
                ? "border-teal-300 shadow-teal-100"
                : voiceState === "PROCESSING"
                ? "border-indigo-200 shadow-indigo-100"
                : "border-slate-200"
            }`}
          >
            {/* Ambient background glow */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-sky-200/20 rounded-full blur-2xl pointer-events-none" />

            {/* Persistent Avatar with real-time mood reflection */}
            <div className="my-2">
              <CaseLineAvatar
                size="lg"
                character={character}
                interviewState={interviewState}
                mood={getAvatarMood()}
                pose="interview"
                showStatusBadge={true}
                showWaveformBars={true}
              />
            </div>

            {/* Status indicator pill with real-time animation classes */}
            <div className="mt-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  interviewState === "LISTENING"
                    ? "bg-sky-100 text-sky-800 border border-sky-300 animate-caseline-listen-glow"
                    : interviewState === "PROCESSING"
                    ? "bg-indigo-100 text-indigo-800 border border-indigo-300 animate-caseline-processing-pulse"
                    : interviewState === "SPEAKING"
                    ? "bg-teal-100 text-teal-800 border border-teal-300 animate-caseline-speak-glow animate-caseline-speak-cadence"
                    : interviewState === "ERROR"
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-slate-100 text-slate-700 animate-caseline-breathe"
                }`}
              >
                {interviewState === "LISTENING" && (
                  <span className="w-2 h-2 rounded-full bg-sky-600 animate-ping" />
                )}
                {interviewState === "PROCESSING" && (
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                )}
                {interviewState === "SPEAKING" && (
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                )}
                <span>
                  {interviewState === "READY"
                    ? "Ready for your answer"
                    : interviewState === "LISTENING"
                    ? "Listening to your voice..."
                    : interviewState === "PROCESSING"
                    ? "AI Analyzing symptoms..."
                    : interviewState === "SPEAKING"
                    ? "Speaking question aloud..."
                    : interviewState === "ERROR"
                    ? "Voice input error"
                    : "Voice ready"}
                </span>
              </span>
            </div>

            {/* Urgent Triage Holding State vs Regular Intake Question Card */}
            {urgentSafetyAlert ? (
              <div className="w-full bg-rose-50/90 border-2 border-rose-300 rounded-3xl p-5 sm:p-6 text-left space-y-4 my-2 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                      Hospital Triage Early Alert Active
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-rose-950 leading-tight">
                      {urgentSafetyAlert.displayTitle}
                    </h3>
                  </div>
                </div>

                {/* Calming Spoken Message in Patient Language */}
                <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-2xs space-y-2">
                  <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                    "{urgentSafetyAlert.advice}"
                  </p>
                  {selectedLanguage.name !== "English" && (
                    <p className="text-xs text-slate-500 font-medium italic pt-1 border-t border-slate-100">
                      "Your symptoms may need urgent medical attention. Please stay here. A healthcare staff member will assist you."
                    </p>
                  )}
                </div>

                {/* Patient statement confirmation */}
                <div className="text-xs bg-rose-100/70 p-3 rounded-xl text-rose-900 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-[10px] uppercase text-rose-800 block">
                      Reported Symptom:
                    </span>
                    <span className="italic">"{urgentSafetyAlert.patientStatement}"</span>
                  </div>
                  <span className="font-mono text-[10px] text-rose-700 shrink-0">
                    {urgentSafetyAlert.timestamp}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onTriggerSos}
                    className="px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <AlertOctagon className="w-4 h-4" />
                    <span>Emergency SOS / Alert Nurse</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => speakText(urgentSafetyAlert.advice)}
                    className="px-4 py-3 bg-white hover:bg-slate-50 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-rose-600" />
                    <span>Re-play Voice Instructions</span>
                  </button>
                </div>

                {/* Staff override to continue intake if patient was cleared by triage */}
                <div className="pt-2 text-center border-t border-rose-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setUrgentSafetyAlert(null);
                      loadNextQuestion(messages);
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Staff Override: Patient cleared by triage clinician, resume routine intake â†’
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Current Question section with audio indicator */}
                <div className="max-w-lg w-full mb-3 flex items-start justify-between gap-3 bg-sky-50/50 p-4 rounded-2xl border border-sky-100 text-left">
                  <div className="flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 block mb-1">
                      Current Question ({currentQuestion?.category || "Clinical Intake"})
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                      {currentQuestion?.textInLang || "Loading intake question..."}
                    </h3>
                    {currentQuestion?.textInEng && (
                      <p className="text-xs text-slate-500 font-medium mt-1 italic">
                        "{currentQuestion.textInEng}"
                      </p>
                    )}
                    {currentQuestion?.rationale && (
                      <div className="mt-2 pt-1.5 border-t border-sky-100 flex items-center gap-1.5 text-[11px] text-sky-800">
                        <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span><strong>Clinical Intent:</strong> {currentQuestion.rationale}</span>
                      </div>
                    )}
                  </div>

                  {/* Sound/Audio indicator button next to question */}
                  <button
                    type="button"
                    onClick={() =>
                      currentQuestion && speakText(currentQuestion.textInLang)
                    }
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md transition-all cursor-pointer group ${
                      voiceState === "SPEAKING"
                        ? "bg-teal-600 text-white ring-4 ring-teal-300/50 animate-caseline-speak-glow animate-caseline-speak-cadence"
                        : "bg-sky-600 hover:bg-sky-700 text-white"
                    }`}
                    title="Tap to listen to question audio"
                  >
                    <Volume2
                      className={`w-5 h-5 transition-transform ${
                        voiceState === "SPEAKING" ? "animate-pulse" : "group-hover:scale-110"
                      }`}
                    />
                  </button>
                </div>

                {/* Audio Waveform visualization */}
                <div
                  className={`w-full max-w-xs h-8 flex items-center justify-center gap-1.5 py-1 mb-3 rounded-full transition-all ${
                    voiceState === "LISTENING"
                      ? "bg-sky-50/80 animate-caseline-listen-glow"
                      : voiceState === "SPEAKING"
                      ? "bg-teal-50/80 animate-caseline-speak-glow"
                      : ""
                  }`}
                >
                  {waveformLevels.map((height, i) => (
                    <span
                      key={i}
                      style={{ height: `${height}%` }}
                      className={`w-1.5 rounded-full transition-all duration-100 ${
                        voiceState === "LISTENING"
                          ? "bg-sky-500 shadow-xs"
                          : voiceState === "SPEAKING"
                          ? "bg-teal-500"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>

                {/* Error Message if Mic denied */}
                {speechError && (
                  <div className="w-full mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 text-left font-medium">
                    {speechError}
                  </div>
                )}

                {/* Controls Bar: Repeat Question | Mic Button | Pause / Resume */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 mb-4">
                  {/* Repeat Question button */}
                  <button
                    type="button"
                    id="interview-repeat-btn"
                    onClick={() => {
                      if (currentQuestion) {
                        speakText(currentQuestion.textInLang);
                      }
                    }}
                    disabled={isPaused}
                    className="flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 transition-all cursor-pointer disabled:opacity-50"
                    title="Repeat the current question aloud"
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-2xs">
                      <RotateCcw className="w-5 h-5 text-sky-600" />
                    </div>
                    <span className="text-[11px] font-bold">Repeat Question</span>
                  </button>

                  {/* Central Microphone Button */}
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      id="interview-mic-btn"
                      disabled={isPaused || interviewState === "SPEAKING"}
                      onClick={() => {
                        if (voiceState === "LISTENING") {
                          stopSpeechRecognition();
                        } else {
                          startSpeechRecognition();
                        }
                      }}
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all shadow-xl cursor-pointer active:scale-95 disabled:opacity-50 ${
                        voiceState === "LISTENING"
                          ? "bg-rose-500 hover:bg-rose-600 ring-8 ring-rose-300/40 animate-caseline-listen-glow scale-105"
                          : voiceState === "SPEAKING"
                          ? "bg-gradient-to-tr from-teal-600 to-emerald-600 ring-4 ring-teal-300/40 animate-caseline-speak-glow animate-caseline-speak-cadence"
                          : voiceState === "PROCESSING"
                          ? "bg-gradient-to-tr from-indigo-600 to-sky-600 ring-4 ring-indigo-300/40 animate-caseline-processing-pulse"
                          : "bg-gradient-to-tr from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 ring-4 ring-sky-300/30 animate-caseline-breathe"
                      }`}
                      title={voiceState === "LISTENING" ? "Stop recording" : "Speak in your language"}
                    >
                      {voiceState === "LISTENING" ? (
                        <MicOff className="w-9 h-9" />
                      ) : (
                        <Mic className="w-9 h-9" />
                      )}
                    </button>
                    <span className="text-xs sm:text-sm font-black text-slate-800">
                      {isPaused
                        ? "Interview Paused"
                        : voiceState === "LISTENING"
                        ? "Tap to Stop"
                        : "Tap to Speak"}
                    </span>
                  </div>

                  {/* Pause / Resume button */}
                  <button
                    type="button"
                    id="interview-pause-btn"
                    onClick={() => {
                      if (isPaused) {
                        setIsPaused(false);
                        if (currentQuestion) speakText(currentQuestion.textInLang);
                      } else {
                        setIsPaused(true);
                        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
                        stopSpeechRecognition();
                        setInterviewState("READY");
                      }
                    }}
                    className={`flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
                      isPaused
                        ? "bg-amber-100 border-amber-300 text-amber-900 shadow-2xs"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                    title={isPaused ? "Resume interview" : "Pause interview"}
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-2xs">
                      {isPaused ? (
                        <Play className="w-5 h-5 text-amber-600 ml-0.5" />
                      ) : (
                        <Pause className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold">
                      {isPaused ? "Resume" : "Pause"}
                    </span>
                  </button>
                </div>

                {/* Quick Response suggestions (chips) */}
                <div className="w-full mb-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Quick Response Suggestions
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {currentQuestion?.options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAnswer(opt, "touch")}
                        className="px-3.5 py-2 rounded-full bg-sky-50/80 hover:bg-sky-100 hover:border-sky-300 border border-slate-200 text-slate-800 font-extrabold text-xs text-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Answer Input Section: Input field & Submit button */}
                <div className="w-full pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={typedInput}
                      onChange={(e) => setTypedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && typedInput.trim()) {
                          handleAnswer(typedInput, "text");
                        }
                      }}
                      placeholder="Or type your answer here..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      id="interview-submit-text-btn"
                      onClick={() => handleAnswer(typedInput, "text")}
                      disabled={!typedInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Submit</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Interactive Body Pain Location Trigger & Status */}
                <div className="w-full mb-3 flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                        Body Pain Location
                      </div>
                      <div className="text-xs font-bold text-amber-950 truncate">
                        {confirmedPainLocations.length > 0
                          ? confirmedPainLocations.map((l) => l.displayName).join(", ")
                          : "Select specific body area on interactive map"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="open-body-pain-selector-btn"
                    onClick={() => setShowBodySelector(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shrink-0 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    {confirmedPainLocations.length > 0 ? (
                      <>
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Location</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Point on Body</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Next Button: Proceed to Medical Timeline */}
                <div className="w-full mt-4 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    id="interview-review-summary-btn"
                    onClick={() => onInterviewComplete(messages, activeRedFlags, confirmedPainLocations)}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black text-sm shadow-md shadow-sky-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Proceed to Medical Timeline â†’</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT / CHAT: Conversation History (5 Columns on large screen) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col h-[620px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">
                Conversation Side Panel
              </h4>
              <p className="text-xs text-slate-500">
                {messages.length} exchanges recorded
              </p>
            </div>

            {/* Finish intake button if at least 3 messages */}
            {messages.length >= 3 && (
              <button
                type="button"
                onClick={() => onInterviewComplete(messages, activeRedFlags, confirmedPainLocations)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Finish & View Timeline</span>
              </button>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs"
          >
            {messages.map((m) => {
              const isAi = m.sender === "ai";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    isAi ? "items-start" : "items-end"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 px-1">
                    <span className="font-bold">
                      {isAi ? "CaseLine AI" : patient.name}
                    </span>
                    <span>â€¢</span>
                    <span>{m.timestamp}</span>
                    {m.source && (
                      <span className="capitalize text-slate-400 font-medium">
                        via {m.source}
                      </span>
                    )}
                  </div>

                  <div
                    className={`max-w-[88%] rounded-2xl p-3 leading-relaxed ${
                      isAi
                        ? "bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200/70"
                        : "bg-sky-600 text-white rounded-tr-xs shadow-xs"
                    }`}
                  >
                    <p className="font-semibold text-xs sm:text-sm">{m.text}</p>
                    {isAi && m.textInEnglish && (
                      <p className="text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-200 italic">
                        {m.textInEnglish}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {voiceState === "PROCESSING" && (
              <div className="flex items-center gap-2 text-slate-500 text-xs italic py-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                <span>CaseLine is formulating the next clinical question...</span>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              id="interview-complete-action-btn"
              onClick={() => onInterviewComplete(messages, activeRedFlags, confirmedPainLocations)}
              className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Save & Proceed to Clinical Summary</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Body Pain Location Selector Modal */}
      {showBodySelector && (
        <div
          id="body-location-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="w-full max-w-5xl my-auto animate-in fade-in zoom-in-95 duration-200">
            <BodyPainLocationSelector
              selectedLanguage={selectedLanguage}
              initialLocations={confirmedPainLocations}
              suggestedComplaint={suggestedPainArea}
              onConfirmLocations={handleConfirmBodyLocations}
              onClose={handleCloseBodySelector}
              character={character}
            />
          </div>
        </div>
      )}
    </div>
  );
};



