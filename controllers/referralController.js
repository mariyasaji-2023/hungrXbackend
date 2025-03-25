const express = require('express');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const ReferralCode = require('../models/referralModel'); // Import your model

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
const referral = async (req, res) => {
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

module.exports = { referral };