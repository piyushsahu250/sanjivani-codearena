const prisma = require("../prisma");

// Maps weak-area labels from an interview report (subject names like "Java", coding topics like
// "Arrays", or aptitude categories like "QUANTITATIVE") to a concrete next action. Only claims a
// specific Learning Module (and its coding practice count) exists when a real title match is
// found — the "java" course is the only one with real authored content right now (python/cpp/sql
// are "Coming soon" stubs), so everything else gets an honest generic action instead of a link
// to content that isn't there.
async function buildRecommendations(weakAreas) {
  if (!weakAreas || weakAreas.length === 0) return [];

  const javaCourse = await prisma.course.findUnique({
    where: { slug: "java" },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { select: { id: true } } } } },
  });

  const recommendations = [];
  for (const area of weakAreas.slice(0, 5)) {
    const lower = area.toLowerCase();
    const matchedModule = javaCourse?.modules.find((m) => m.title.toLowerCase().includes(lower));

    if (matchedModule) {
      const lessonIds = matchedModule.lessons.map((l) => l.id);
      const suggestedCodingPractice = lessonIds.length
        ? await prisma.practiceQuestion.count({ where: { lessonId: { in: lessonIds }, type: "CODING" } })
        : 0;
      recommendations.push({
        area,
        action: `Complete "${matchedModule.title}" in the Java Learning Module${suggestedCodingPractice > 0 ? `, then solve its ${suggestedCodingPractice} coding practice problem${suggestedCodingPractice === 1 ? "" : "s"}` : ""} before your next interview.`,
        link: "/learning/java",
        suggestedCodingPractice,
      });
    } else if (/^(java|python|c\+\+|javascript|sql|dbms|os|cn|oop|dsa)$/i.test(area)) {
      recommendations.push({
        area,
        action: `Review the "${area}" subject area and solve a few more coding practice problems in it before your next Technical interview.`,
        link: "/learning",
        suggestedCodingPractice: null,
      });
    } else {
      recommendations.push({
        area,
        action: `Attempt another ${area} interview session, focusing specifically on this topic.`,
        link: "/interview",
        suggestedCodingPractice: null,
      });
    }
  }
  return recommendations;
}

module.exports = { buildRecommendations };
