const verifyReferralCode = async (req, res) => {
  try {
    const { userId, referralCode } = req.body
    if (!userId || !referralCode) {
      return res.status(400).json({
        status: false,
        message:'Missing required parameters'
      })
    }
  } catch (error) {

  }
}