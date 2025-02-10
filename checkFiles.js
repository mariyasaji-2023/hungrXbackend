const loginWithApple = async (req, res) => {
  const { id_token, code } = req.body;
  try {
    const decoded = jwt.decoded(id_token, { complete: true })
    if (!decoded) {
      return res.status(400).json({
        status: false,
        data: {
          message: 'invalid token'
        }
      })
    }
    const { sub: appleId, appleEmail } = decoded.payload;
    const name = req.body.user?.name?.firstName
      ? `${req.body.user.name.firstName} ${req.body.user.name.lastName || ''}`
      : undefined;


  } catch (error) {

  }
}