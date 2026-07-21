// Curated catalog of companies the AI-Powered Mock Interview System supports browsing/generating
// for. Unlike InterviewQuestion.company (free text, derived purely from whatever's already been
// authored), this is a fixed list so the student-facing browse grid can show every company —
// including ones with zero seeded questions yet — rather than only companies that already have
// content. Admins can still create/generate questions for a company not in this list (the
// underlying field stays free text); this list only drives what the browse/generate UI suggests.
const COMPANIES = [
  "Google", "Microsoft", "Amazon", "Adobe", "Goldman Sachs", "TCS", "Infosys", "Accenture",
  "Capgemini", "Cognizant", "Deloitte", "Wipro", "Zoho", "Flipkart", "PhonePe", "Uber", "Swiggy",
  "Zomato", "Atlassian", "Oracle", "SAP", "JPMorgan Chase", "Morgan Stanley", "ServiceNow",
  "NVIDIA", "Intel", "Qualcomm",
];

module.exports = { COMPANIES };
