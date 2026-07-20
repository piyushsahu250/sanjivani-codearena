const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { cached, invalidate } = require("../utils/cache");
const { logAudit, AUDIT_ACTIONS } = require("../utils/auditLog");

const router = express.Router();

// ADMIN/STAFF: list all institutes. Cached — this list changes rarely (an admin adding/editing
// an institute is a rare event, not a per-request one) but gets read on nearly every admin page
// load for the institute-picker dropdown. Invalidated explicitly on create/update/delete below
// rather than relying on the 2-minute TTL to catch up.
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const institutes = await cached("institutes:list", 2 * 60 * 1000, () =>
    prisma.institute.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { classes: true, users: true } } },
    })
  );
  res.json(institutes);
});

// ADMIN: create an institute
router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, code, address, contact } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Institute name is required" });

    const existing = await prisma.institute.findUnique({ where: { name: name.trim() } });
    if (existing) return res.status(409).json({ error: "An institute with this name already exists" });

    const institute = await prisma.institute.create({
      data: { name: name.trim(), code: code?.trim() || null, address: address?.trim() || null, contact: contact?.trim() || null },
    });
    invalidate("institutes:");
    res.json(institute);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create institute" });
  }
});

// ADMIN: edit details, or toggle active/inactive
router.patch("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.institute.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Institute not found" });

    const { name, code, address, contact, isActive, logoUrl, passwordExpiryDays, passwordHistoryDepth, singleSessionOnly, aiHintsEnabled } = req.body;
    if (name && name.trim() !== existing.name) {
      const dup = await prisma.institute.findUnique({ where: { name: name.trim() } });
      if (dup) return res.status(409).json({ error: "An institute with this name already exists" });
    }
    if (passwordExpiryDays !== undefined && passwordExpiryDays !== null && (!Number.isFinite(Number(passwordExpiryDays)) || Number(passwordExpiryDays) < 0)) {
      return res.status(400).json({ error: "Password expiry days must be a non-negative number, or blank for never" });
    }
    if (passwordHistoryDepth !== undefined && (!Number.isFinite(Number(passwordHistoryDepth)) || Number(passwordHistoryDepth) < 0)) {
      return res.status(400).json({ error: "Password history depth must be a non-negative number" });
    }

    const institute = await prisma.institute.update({
      where: { id: req.params.id },
      data: {
        name: name?.trim() ?? existing.name,
        code: code !== undefined ? (code?.trim() || null) : existing.code,
        address: address !== undefined ? (address?.trim() || null) : existing.address,
        contact: contact !== undefined ? (contact?.trim() || null) : existing.contact,
        isActive: isActive ?? existing.isActive,
        logoUrl: logoUrl !== undefined ? (logoUrl || null) : existing.logoUrl,
        passwordExpiryDays: passwordExpiryDays !== undefined ? (passwordExpiryDays === null || passwordExpiryDays === "" ? null : Number(passwordExpiryDays)) : existing.passwordExpiryDays,
        passwordHistoryDepth: passwordHistoryDepth !== undefined ? Number(passwordHistoryDepth) : existing.passwordHistoryDepth,
        singleSessionOnly: singleSessionOnly !== undefined ? !!singleSessionOnly : existing.singleSessionOnly,
        aiHintsEnabled: aiHintsEnabled !== undefined ? !!aiHintsEnabled : existing.aiHintsEnabled,
      },
    });
    invalidate("institutes:");
    await logAudit({ req, action: AUDIT_ACTIONS.INSTITUTE_CONFIG_CHANGED, actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role, instituteId: institute.id, details: { instituteName: institute.name, changedFields: Object.keys(req.body) } });
    res.json(institute);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update institute" });
  }
});

// ADMIN: delete an institute — only if no dependent classes or users exist
router.delete("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const [classCount, userCount] = await Promise.all([
      prisma.class.count({ where: { instituteId: req.params.id } }),
      prisma.user.count({ where: { instituteId: req.params.id } }),
    ]);
    if (classCount > 0 || userCount > 0) {
      return res.status(409).json({ error: "This institute has classes or users linked to it and can't be deleted. Remove or reassign them first." });
    }
    await prisma.institute.delete({ where: { id: req.params.id } });
    invalidate("institutes:");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete institute" });
  }
});

module.exports = router;
