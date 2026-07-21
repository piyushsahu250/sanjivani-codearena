// Single source of truth for the 7 InterviewCategory enum values and 4 AptitudeCategory enum
// values — shared by InterviewAdmin.jsx and InterviewDraftReview.jsx so the two admin surfaces
// can never silently drift out of sync with each other or with the backend enum (interview.js's
// own VALID_CATEGORIES constant).
export const CATEGORIES = ["HR", "TECHNICAL", "CODING", "APTITUDE", "SYSTEM_DESIGN", "BEHAVIORAL", "MANAGERIAL"];
export const APTITUDE_CATS = ["QUANTITATIVE", "LOGICAL", "VERBAL", "DATA_INTERPRETATION"];
export const PACKAGE_BANDS = ["LPA_3_5", "LPA_5_10", "LPA_10_20", "LPA_20_PLUS"];
export const PACKAGE_BAND_LABEL = { LPA_3_5: "3-5 LPA", LPA_5_10: "5-10 LPA", LPA_10_20: "10-20 LPA", LPA_20_PLUS: "20+ LPA" };
export const EXPERIENCE_LEVELS = ["FRESHER", "EXPERIENCED"];
export const FREQUENCY_TAGS = ["FREQUENTLY_ASKED", "RECENTLY_ASKED", "TRENDING", "COMPANY_SPECIFIC"];
export const FREQUENCY_TAG_LABEL = { FREQUENTLY_ASKED: "Frequently Asked", RECENTLY_ASKED: "Recently Asked", TRENDING: "Trending", COMPANY_SPECIFIC: "Company Specific" };
