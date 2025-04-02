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
      return res.status(400).json({
        error: 'Missing required parameter: userId'
      });
    }

    let isNewCode = false;

    // Check if user already has a referral code in database
    let userReferral = await ReferralCode.findOne({ userId });

    if (!userReferral) {
      // Generate a new unique code for this user
      let newCode;
      let codeExists = true;

      // Keep generating until we find a unique code that doesn't exist in DB
      while (codeExists) {
        newCode = generateUniqueReferralCode();
        const existingCode = await ReferralCode.findOne({ code: newCode });
        if (!existingCode) {
          codeExists = false;
        }
      }

      // Create and save the new referral code
      userReferral = new ReferralCode({
        userId,
        code: newCode
      });

      await userReferral.save();
      isNewCode = true;
    }

    // Return the user's referral code
    return res.status(200).json({
      userId,
      referralCode: userReferral.code,
      isNewCode
    });

  } catch (error) {
    console.error('Error generating referral code:', error);
    return res.status(500).json({
      error: 'Failed to process referral code request'
    });
  }
};


const verifyRef = async (req, res) => {
  try {
    const { userId, referralCode, expirationDate } = req.body
    if (!userId || !referralCode || !expirationDate) {
      return res.status(400).json({
        status: false,
        message: 'Missing required parameters: userId, referralCode and expirationDate are required'
      })
    }
    const referralRecord = await ReferralCode.findOne({ code: referralCode })

    if (!referralRecord) {
      return res.status(404).json({
        status: false,
        message: 'Invalid referral code'
      });
    }
    // Verify the user trying to use the code exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }


    // Check if user already used a referral code
    if (user.hasUsedReferralCode) {
      return res.status(400).json({
        status: false,
        message: 'User has already used a referral code',
        'revenuecatDetails.expirationDate': expirationDate
      });
    }

    // Check if user is trying to use their own referral code
    if (referralRecord.userId === userId) {
      return res.status(400).json({
        status: false,
        message: 'Users cannot use their own referral code'
      });
    }

    // Update the user's record to indicate they've used a referral code
    // Also update the revenuecatDetails.expirationDate field
    await User.findByIdAndUpdate(userId, {
      hasUsedReferralCode: true,
      referralCodeUsed: referralCode,
      referralCodeOwner: referralRecord.userId,
      'revenuecatDetails.expirationDate': expirationDate
    });

    // You might also want to track which users have used this code
    // and possibly update the referral code owner with rewards

    return res.status(200).json({
      status: true,
      message: 'Referral code verified successfully',
      userId,
      referralCode,
      expirationDate
    });

  } catch (error) {
    console.error('Error verifying referral code:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to verify referral code',
      error: error.message
    });
  }
}

module.exports = { generateRef, verifyRef };