const express = require("express");

const { asyncHandler } = require("../../middleware/async");

const router = express.Router();

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    res.json({ ok: true });
  }),
);

module.exports = {
  telegramApiRouter: router,
};
