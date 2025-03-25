const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage for demo purposes
// In production, use a database instead
const userReferralCodes = new Map();
const existingCodes = new Set();

/**
 * Generates a unique 6-character referral code with both letters and digits
 * @returns {string} A unique referral code
 */
function generateUniqueReferralCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters like O/0, 1/I
  const codeLength = 6;
  let code;
  
  // Keep generating until we find a unique code
  do {
    code = '';
    for (let i = 0; i < codeLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }
  } while (existingCodes.has(code));
  
  // Mark this code as used
  existingCodes.add(code);
  return code;
}

/**
 * Route to generate or retrieve a referral code for a user
 * POST /api/referral-code
 * Request body: { userId: string }
 * Response: { userId: string, referralCode: string, isNewCode: boolean }
 */
router.post('/', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: userId'
      });
    }
    
    let isNewCode = false;
    
    // Check if user already has a referral code
    if (!userReferralCodes.has(userId)) {
      // Generate a new unique code for this user
      const newCode = generateUniqueReferralCode();
      userReferralCodes.set(userId, newCode);
      isNewCode = true;
    }
    
    // Return the user's referral code
    return res.status(200).json({
      userId,
      referralCode: userReferralCodes.get(userId),
      isNewCode
    });
    
  } catch (error) {
    console.error('Error generating referral code:', error);
    return res.status(500).json({ 
      error: 'Failed to process referral code request'
    });
  }
});

module.exports = router;

// Example server setup
/*
const app = express();
app.use(express.json());
app.use('/api/referral-code', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/