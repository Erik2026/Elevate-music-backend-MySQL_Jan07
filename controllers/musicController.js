// controllers/musicController.js
import Music from '../models/Music.js';
import Category from '../models/Category.js';
import asyncHandler from 'express-async-handler';
import { Op } from 'sequelize';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
import sanitizeHtml from 'sanitize-html';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plain-text sanitizer for freeform text fields
function sanitizeText(input = '') {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return '';
  return sanitizeHtml(trimmed, { allowedTags: [], allowedAttributes: {} });
}

// Security: Validate and sanitize filename
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return null;
  }
  // Remove any path separators and directory traversal attempts
  const sanitized = path.basename(filename);
  // Only allow alphanumeric, dash, underscore, and dot
  if (!/^[a-zA-Z0-9._-]+$/.test(sanitized)) {
    return null;
  }
  return sanitized;
};

// @desc    Get music by category
// @route   GET /api/music/category/:categoryId
// @access  Public
const getMusicByCategory = asyncHandler(async (req, res) => {
  try {
    const { categoryId } = req.params;

    const musicList = await Music.findAll({
      where: { categoryId },
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'description', 'types']
      }]
    });

    if (!musicList.length) {
      return res.status(404).json({ message: 'No music found for this category' });
    }

    const musicWithUrls = musicList.map((music) => {
      // Always return relative URLs so clients can prepend their own base
      const fileName = music.fileUrl ? path.basename(music.fileUrl) : null;
      const thumbnailName = music.thumbnailUrl ? path.basename(music.thumbnailUrl) : null;

      let categoryTypeDetails = null;
      if (music.category && music.categoryType && music.category.types) {
        categoryTypeDetails = music.category.types.find(
          (type) => type._id.toString() === music.categoryType.toString(),
        );
      }

      return {
        ...music._doc,
        fileUrl: fileName ? `/uploads/${fileName}` : null,
        thumbnailUrl: thumbnailName ? `/uploads/${thumbnailName}` : null,
        category: music.category
          ? {
              _id: music.category._id,
              name: music.category.name,
              description: music.category.description,
            }
          : null,
        categoryType: categoryTypeDetails || null,
      };
    });

    res.json(musicWithUrls);
  } catch (error) {
    console.error('Error in getMusicByCategory:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});
// @desc    Get all music with category and type details
// @route   GET /api/music
// @access  Public
// controllers/musicController.js
const getMusic = asyncHandler(async (req, res) => {
  try {
    const musicList = await Music.findAll({
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'description', 'types']
      }]
    });

    const musicWithUrls = musicList.map((music) => {
      // Always return relative URLs so clients can prepend their own base
      const fileName = music.fileUrl ? path.basename(music.fileUrl) : null;
      const thumbnailName = music.thumbnailUrl ? path.basename(music.thumbnailUrl) : null;

      // Safely handle categoryType lookup
      let categoryTypeDetails = null;
      if (music.category && music.categoryType && music.category.types) {
        categoryTypeDetails = music.category.types.find(
          (type) => type.id == music.categoryType,
        );
      }

      return {
        ...music.toJSON(),
        fileUrl: fileName ? `/uploads/${fileName}` : null,
        thumbnailUrl: thumbnailName ? `/uploads/${thumbnailName}` : null,
        category: music.category
          ? {
              id: music.category.id,
              name: music.category.name,
              description: music.category.description,
            }
          : null, // Handle null category
        categoryType: categoryTypeDetails || {
          id: parseInt(music.categoryType) || 0,
          name: 'Unknown',
          description: ''
        },
      };
    });

    res.json(musicWithUrls);
  } catch (error) {
    console.error('Error in getMusic:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Create new music with file and thumbnail upload
// @route   POST /api/music/create
// @access  Private/Admin
const createMusic = asyncHandler(async (req, res) => {
  const {
    title,
    artist,
    category,
    categoryType,
    duration,
    releaseDate,
    description: rawDescription,
  } = req.body;
  const audioFile = req.files?.file?.[0];
  const thumbnailFile = req.files?.thumbnail?.[0];

  // Validate required fields
  const missingFields = [];
  if (!title) missingFields.push('title');
  if (!artist) missingFields.push('artist');
  if (!category) missingFields.push('category');
  if (!categoryType) missingFields.push('categoryType'); // Add this
  if (!audioFile) missingFields.push('file');
  if (!duration) missingFields.push('duration');
  if (!releaseDate) missingFields.push('releaseDate');

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: 'Missing required fields',
      missing: missingFields,
    });
  }

  try {
    const description = sanitizeText(rawDescription);
    if (description.length > 1000) {
      return res
        .status(400)
        .json({ message: 'Description must be 1000 characters or fewer' });
    }
    const musicData = {
      title,
      artist,
      categoryId: category,
      categoryType: categoryType, // Always set since validated
      fileUrl: `/uploads/${audioFile.filename}`,
      duration: Number(duration),
      releaseDate: new Date(releaseDate),
      userId: req.user.id,
      description,
    };

    if (thumbnailFile) {
      musicData.thumbnailUrl = `/uploads/${thumbnailFile.filename}`;
    }

    const music = await Music.create(musicData);
    const populatedMusic = await Music.findByPk(music.id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'description']
      }]
    });
    res.status(201).json(populatedMusic);
  } catch (error) {
    console.error('Create music error:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
    });
  }
});

// @desc    Update music
// @route   PUT /api/music/:id
// @access  Private/Admin
const updateMusic = asyncHandler(async (req, res) => {
  try {
    const music = await Music.findByPk(req.params.id);

    if (!music) {
      return res.status(404).json({ message: 'Music not found' });
    }

    // Allow direct URL updates (admin metadata fix without re-uploading files)
    if (req.body.fileUrl) {
      music.fileUrl = req.body.fileUrl;
    }
    if (req.body.thumbnailUrl) {
      music.thumbnailUrl = req.body.thumbnailUrl;
    }

    // Handle file uploads (if provided)
    const audioFile = req.files?.file?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    // Update fields
    music.title = req.body.title || music.title;
    music.artist = req.body.artist || music.artist;
    // Validate UUIDs before assignment
    if (req.body.category) {
      music.categoryId = req.body.category;
    }
    if (req.body.categoryType) {
      music.categoryType = req.body.categoryType;
    }
    music.duration = req.body.duration || music.duration;
    music.releaseDate = req.body.releaseDate || music.releaseDate;

    // Description (optional) with sanitization and length guard
    if (typeof req.body.description !== 'undefined') {
      const description = sanitizeText(req.body.description);
      if (description.length > 1000) {
        return res
          .status(400)
          .json({ message: 'Description must be 1000 characters or fewer' });
      }
      music.description = description;
    }

    if (audioFile) {
      if (music.fileUrl) {
        const sanitizedFileName = sanitizeFilename(path.basename(music.fileUrl));
        if (sanitizedFileName) {
          const oldFilePath = path.join(__dirname, '../uploads', sanitizedFileName);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
      }
      music.fileUrl = `/uploads/${audioFile.filename}`;
    }

    if (thumbnailFile) {
      if (music.thumbnailUrl) {
        const sanitizedThumbName = sanitizeFilename(path.basename(music.thumbnailUrl));
        if (sanitizedThumbName) {
          const oldThumbPath = path.join(__dirname, '../uploads', sanitizedThumbName);
          if (fs.existsSync(oldThumbPath)) {
            fs.unlinkSync(oldThumbPath);
          }
        }
      }
      music.thumbnailUrl = `/uploads/${thumbnailFile.filename}`;
    }

    const updatedMusic = await music.save();
    const populatedMusic = await Music.findByPk(updatedMusic.id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'description']
      }]
    });
    res.json(populatedMusic);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
    });
  }
});

// @desc    Delete music
// @route   DELETE /api/music/:id
// @access  Private/Admin
const deleteMusic = asyncHandler(async (req, res) => {
  const music = await Music.findByPk(req.params.id);
  if (!music) {
    res.status(404);
    throw new Error('Music not found');
  }

  // Clean up files
  if (music.fileUrl) {
    const sanitizedFileName = sanitizeFilename(path.basename(music.fileUrl));
    if (sanitizedFileName) {
      const filePath = path.join(__dirname, '../uploads', sanitizedFileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
  if (music.thumbnailUrl) {
    const sanitizedThumbName = sanitizeFilename(path.basename(music.thumbnailUrl));
    if (sanitizedThumbName) {
      const thumbPath = path.join(__dirname, '../uploads', sanitizedThumbName);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
  }

  await Music.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Music deleted successfully' });
});

// @desc    Upload a single file (for bulk upload)
// @route   POST /api/music/upload
// @access  Private/Admin
const uploadFile = asyncHandler(async (req, res) => {
  try {
    // The upload middleware uses .fields() so files are in req.files
    const audioFile = req.files?.file?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (!audioFile && !thumbnailFile) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Return the first available file (audio takes priority)
    const uploadedFile = audioFile || thumbnailFile;
    const fileUrl = `/uploads/${uploadedFile.filename}`;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl: fileUrl,
      filename: uploadedFile.filename,
      fieldname: uploadedFile.fieldname,
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
});

// @desc    Update database URLs from old server to new server
// @route   POST /api/music/update-urls
// @access  Private (Admin only)
const updateDatabaseUrls = asyncHandler(async (req, res) => {
  try {
    // Get URLs from environment variables
    const OLD_BASE_URL = process.env.OLD_BASE_URL;
    const NEW_BASE_URL = process.env.NEW_BASE_URL || process.env.PRODUCTION_URL;

    if (!OLD_BASE_URL || !NEW_BASE_URL) {
      return res.status(400).json({
        success: false,
        message:
          'Missing environment variables. Please set OLD_BASE_URL and NEW_BASE_URL (or PRODUCTION_URL) in .env file',
      });
    }

    // Extract hostname from old base URL for detection
    let oldHostname;
    try {
      oldHostname = new URL(OLD_BASE_URL).hostname;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OLD_BASE_URL format in environment variables',
      });
    }

    // Find all music records with old server URLs
    const musicRecords = await Music.findAll({
      where: {
        [Op.or]: [
          { fileUrl: { [Op.like]: `%${oldHostname}%` } },
          { thumbnailUrl: { [Op.like]: `%${oldHostname}%` } },
        ],
      },
    });

    console.log(`Found ${musicRecords.length} records to update`);

    if (musicRecords.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No records found with old server URLs. Database is already up to date!',
        updatedCount: 0,
      });
    }

    let updatedCount = 0;

    for (const music of musicRecords) {
      let needsUpdate = false;
      const updateData = {};

      // Update fileUrl if it contains old server URL
      if (music.fileUrl && music.fileUrl.includes(oldHostname)) {
        const newFileUrl = music.fileUrl.replace(OLD_BASE_URL, NEW_BASE_URL);
        updateData.fileUrl = newFileUrl;
        needsUpdate = true;
      }

      // Update thumbnailUrl if it contains old server URL
      if (music.thumbnailUrl && music.thumbnailUrl.includes(oldHostname)) {
        const newThumbnailUrl = music.thumbnailUrl.replace(OLD_BASE_URL, NEW_BASE_URL);
        updateData.thumbnailUrl = newThumbnailUrl;
        needsUpdate = true;
      }

      // Update the record if changes were made
      if (needsUpdate) {
        await Music.update(updateData, { where: { id: music.id } });
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} records`);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedCount} records`,
      updatedCount: updatedCount,
      totalFound: musicRecords.length,
    });
  } catch (error) {
    console.error('Error updating database URLs:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating database URLs',
      error: error.message,
    });
  }
});

export {
  getMusic,
  getMusicByCategory,
  createMusic,
  updateMusic,
  deleteMusic,
  uploadFile,
  updateDatabaseUrls,
};
