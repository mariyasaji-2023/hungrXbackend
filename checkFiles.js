const removeItem = async (req, res) => {

    const { cartId, restaurantId, dishId, servingSize } = req.body;
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");
        const cart = await cartCollection.findOne({
        _id:new ObjectId(cartId)
        })
        if(!cart){
            return res.status(404).json({
                status:false,
                message:"cart not found"
            })
        }

    } catch (error) {

    }
}