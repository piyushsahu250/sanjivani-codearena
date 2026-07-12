const prisma = require("../prisma");

// Maps weak-area labels from an interview report (subject names like "Java", coding topics like
// "Arrays", or aptitude categories like "QUANTITATIVE") to a concrete next action. Only claims a
// specific Learning Module exists when a real title match is found — the "java" course is the
// only one with real authored content right now (python/cpp/sql are "Coming soon" stubs), so
// everything else gets an honest generic action instead of a link to content that isn't there.
async function buildRecommendations(weakAreas) {
  if (!weakAreas || weakAreas.length === 0) return [];

  const javaCourse = await prisma.course.findUnique({
    where: { slug: "java" },
    include: { modules: { orderBy: { order: "asc" } } },
  });

  const recommendations = [];
  for (const area of weakAreas.slice(0, 5)) {
    const lower = area.toLowerCase();
    const matchedModule = javaCourse?.modules.find((m) => m.title.toLowerCase().includes(lower));

    if (matchedModule) {
      recommendations.push({
        area,
        action: `Complete "${matchedModule.title}" in the Java Learning Module, then retake a ${area} coding practice set before your next interview.`,
        link: "/learning/java",
      });
    } else if (/^(java|python|c\+\+|javascript|sql|dbms|os|cn|oop|dsa)$/i.test(area)) {
      recommendations.push({
        area,
        action: `Review the "${area}" subject area and solve a few more coding practice problems in it before your next Technical interview.`,
        link: "/learning",
      });
    } else {
      recommendations.push({
        area,
        action: `Attempt another ${area} interview session, focusing specifically on this topic.`,
        link: "/interview",
      });
    }
  }
  return recommendations;
}

module.exports = { buildRecommendations };
