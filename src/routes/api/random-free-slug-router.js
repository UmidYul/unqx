const express = require("express");
const { asyncHandler } = require("../../middleware/async");
const { getRandomFreeSlug } = require("./random-free-slug");

const router = express.Router();

// GET /api/random-free-slug
router.get("/", asyncHandler(getRandomFreeSlug));

module.exports = {
    randomFreeSlugApiRouter: router,
};
