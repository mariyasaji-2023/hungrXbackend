const getcart = async(req,res)=>{
    const {userId} = req.body 
    try {
        await client.connect();
        const db = client .db(process.env.DB_NAME)
        const cartCollection = db.collection("cartDetails")
        const Carts = await cartCollection.find({userId:userId})
        
    } catch (error) {
        
    }
}