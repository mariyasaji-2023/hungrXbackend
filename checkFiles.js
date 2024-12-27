// const fs = require('fs');

// // Function to convert kcl to calories
// function convertKclToCalories(value) {
//     // Convert string to number and handle potential errors
//     const kcl = parseFloat(value);
//     if (isNaN(kcl)) return value;

//     // Convert kcl to calories (1 kcl = 1000 calories)
//     return (kcl * 1000).toString();
// }

// // Read the input file
// fs.readFile('HungerXDataCollection.restaurants.json', 'utf8', (err, data) => {
//     if (err) {
//         console.error('Error reading file:', err);
//         return;
//     }

//     try {
//         // Parse JSON data
//         const restaurants = JSON.parse(data);

//         // Process each restaurant
//         restaurants.forEach(restaurant => {
//             if (restaurant.categories) {
//                 restaurant.categories.forEach(category => {
//                     if (category.dishes) {
//                         category.dishes.forEach(dish => {
//                             if (dish.servingInfos) {
//                                 dish.servingInfos.forEach(servingInfo => {
//                                     if (servingInfo.servingInfo?.nutritionFacts?.calories?.value) {
//                                         servingInfo.servingInfo.nutritionFacts.calories.value =
//                                             convertKclToCalories(servingInfo.servingInfo.nutritionFacts.calories.value);
//                                         // Update the unit from kcl to cal
//                                         servingInfo.servingInfo.nutritionFacts.calories.unit = 'cal';
//                                     }
//                                 });
//                             }
//                         });
//                     }
//                 });
//             }
//         });

//         // Write the converted data to a new file
//         fs.writeFile(
//             'converted_calories.json',
//             JSON.stringify(restaurants, null, 2),
//             'utf8',
//             (err) => {
//                 if (err) {
//                     console.error('Error writing file:', err);
//                     return;
//                 }
//                 console.log('Successfully converted kcl to calories and saved to converted_calories.json');
//             }
//         );

//     } catch (error) {
//         console.error('Error processing data:', error);
//     }
// });


const removeCart = async (req, res) => {
    const { userId, dishId } = req.body; // Extract userId and dishId from request body
    if (!userId || !dishId) {
        return res.status(400).json({ message: "userId and dishId are required" });
    }

    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");

        // Find the user's cart and remove the specified dish
        const result = await cartCollection.updateOne(
            { userId }, // Match the user's cart
            {
                $pull: { 
                    "orders.$[].items": { dishId }, // Remove the dish from items
                    "dishDetails": { dishId } // Remove the dish from dishDetails
                }
            }
        );

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: "Item removed from cart successfully" });
        } else {
            res.status(404).json({ message: "Item not found in cart or user does not exist" });
        }
    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        await client.close();
    }
};