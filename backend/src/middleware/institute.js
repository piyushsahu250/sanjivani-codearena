const prisma = require("../prisma");

// Fetches the requester's own instituteId so ADMIN/STAFF accounts tied to a specific
// institute only ever see/manage data under it. Accounts with no instituteId (e.g. the
// seeded "Platform Admin") are platform-level and stay unscoped, seeing every institute.
async function attachRequesterInstitute(req, res, next) {
  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.id }, select: { instituteId: true } });
    req.requesterInstituteId = requester?.instituteId || null;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify institute scope" });
  }
}

module.exports = { attachRequesterInstitute };
