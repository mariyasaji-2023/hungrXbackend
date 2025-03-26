const verifyReferralCode = async (req, res) => {
  try {
    const { userId, referralCode } = req.body;

    // Validation
    if (!userId || !referralCode) {
      return res.status(400).json({
        status: false,
        message: 'Missing required parameters: userId and referralCode are required'
      });
    }

    // Check if referral code exists in the database
    const referralRecord = await ReferralCode.findOne({ code: referralCode });
    
    if (!referralRecord) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    // Verify the user trying to use the code exists
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already used a referral code
    if (user.hasUsedReferralCode) {
      return res.status(400).json({
        success: false,
        message: 'User has already used a referral code'
      });
    }

    // Check if user is trying to use their own referral code
    if (referralRecord.userId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Users cannot use their own referral code'
      });
    }

    // Update the user's record to indicate they've used a referral code
    await User.findByIdAndUpdate(userId, { 
      hasUsedReferralCode: true,
      referralCodeUsed: referralCode,
      referralCodeOwner: referralRecord.userId
    });

    // You might also want to track which users have used this code
    // and possibly update the referral code owner with rewards
    
    return res.status(200).json({
      success: true,
      message: 'Referral code verified successfully',
      referralCode,
      referralCodeOwner: referralRecord.userId
    });
    
  } catch (error) {
    console.error('Error verifying referral code:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify referral code',
      error: error.message
    });
  }
};
