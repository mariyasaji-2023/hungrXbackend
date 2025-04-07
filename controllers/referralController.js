const express = require('express');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const ReferralCode = require('../models/referralModel'); // Import your model
const User = require('../models/userModel')

/**
 * Generates a unique 6-character referral code with both letters and digits
 * @returns {string} A unique referral code
 */
function generateUniqueReferralCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters like O/0, 1/I
  const codeLength = 6;
  let code = '';

  for (let i = 0; i < codeLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
}

/**
 * Route to generate or retrieve a referral code for a user
 * POST /api/referral-code
 * Request body: { userId: string }
 * Response: { userId: string, referralCode: string, isNewCode: boolean }
 */
const generateRef = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required parameter: userId' });
    }

    // Check if the user already has a referral code
    let userReferral = await ReferralCode.findOne({ userId }).lean();

    if (userReferral) {
      return res.status(200).json({
        userId,
        referralCode: userReferral.code,
        isNewCode: false
      });
    }

    // Fetch all existing codes once to avoid multiple DB queries
    const existingCodes = new Set(await ReferralCode.distinct('code'));

    let newCode;
    do {
      newCode = generateUniqueReferralCode();
    } while (existingCodes.has(newCode));

    // Save new referral code
    userReferral = await ReferralCode.create({ userId, code: newCode });

    return res.status(200).json({
      userId,
      referralCode: userReferral.code,
      isNewCode: true
    });

  } catch (error) {
    console.error('Error generating referral code:', error);
    return res.status(500).json({ error: 'Failed to process referral code request' });
  }
};



const verifyRef = async (req, res) => {
  try {
    const { userId, referralCode, expirationDate } = req.body;

    if (!userId || !referralCode || !expirationDate) {
      return res.status(400).json({
        status: false,
        message: 'Missing required parameters: userId, referralCode, and expirationDate are required',
      });
    }

    // Fetch referral code and user details in parallel
    const [referralRecord, user] = await Promise.all([
      ReferralCode.findOne({ code: referralCode }).lean().select('userId'),
      User.findById(userId).lean().select('hasUsedReferralCode'),
    ]);

    if (!referralRecord) {
      return res.status(404).json({ status: false, message: 'Invalid referral code' });
    }

    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    if (user.hasUsedReferralCode) {
      return res.status(400).json({
        status: false,
        message: 'User has already used a referral code',
        'revenuecatDetails.expirationDate': expirationDate,
      });
    }

    if (referralRecord.userId.toString() === userId) {
      return res.status(400).json({ status: false, message: 'Users cannot use their own referral code' });
    }

    // Update user in a single database operation
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          hasUsedReferralCode: true,
          referralCodeUsed: referralCode,
          referralCodeOwner: referralRecord.userId,
          expirationDate: expirationDate,
          'revenuecatDetails.expirationDate': expirationDate,
        },
      },
      { new: false }
    );

    return res.status(200).json({
      status: true,
      message: 'Referral code verified successfully',
      userId,
      referralCode,
      expirationDate,
    });

  } catch (error) {
    console.error('Error verifying referral code:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to verify referral code',
      error: error.message,
    });
  }
};

const verifyExpiry = async (req, res) => {
  try {
    const { userId, currentDate } = req.body

    if (!userId || !currentDate) {
      return res.status(400).json({
        message: 'User ID and current date are required'
      })
    }
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      })
    }
    if (!user.expirationDate) {
      return res.status(400).json({
        message: 'Expiration date not set for user'
      })
    }
    const expiryDate = new Date(user.expirationDate);
    const inputDate = new Date(currentDate)

    if (isNaN(expiryDate) || isNaN(inputDate)) {
      return res.status(400).json({
        message: 'Invalid date format'
      })
    }
    const isExpired = inputDate > expiryDate;
    return res.status(200).json({
      isExpired,
      message: isExpired ? 'Expired' : 'Not expired',
      expirationDate:user.expirationDate
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    })
  }
}

module.exports = { generateRef, verifyRef, verifyExpiry };
