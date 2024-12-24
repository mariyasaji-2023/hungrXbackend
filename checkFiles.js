const fs = require('fs');

// Function to convert kcl to calories
function convertKclToCalories(value) {
    // Convert string to number and handle potential errors
    const kcl = parseFloat(value);
    if (isNaN(kcl)) return value;
    
    // Convert kcl to calories (1 kcl = 1000 calories)
    return (kcl * 1000).toString();
}

// Read the input file
fs.readFile('HungerXDataCollection.restaurants.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    try {
        // Parse JSON data
        const restaurants = JSON.parse(data);

        // Process each restaurant
        restaurants.forEach(restaurant => {
            if (restaurant.categories) {
                restaurant.categories.forEach(category => {
                    if (category.dishes) {
                        category.dishes.forEach(dish => {
                            if (dish.servingInfos) {
                                dish.servingInfos.forEach(servingInfo => {
                                    if (servingInfo.servingInfo?.nutritionFacts?.calories?.value) {
                                        servingInfo.servingInfo.nutritionFacts.calories.value = 
                                            convertKclToCalories(servingInfo.servingInfo.nutritionFacts.calories.value);
                                        // Update the unit from kcl to cal
                                        servingInfo.servingInfo.nutritionFacts.calories.unit = 'cal';
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        // Write the converted data to a new file
        fs.writeFile(
            'converted_calories.json', 
            JSON.stringify(restaurants, null, 2), 
            'utf8',
            (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                    return;
                }
                console.log('Successfully converted kcl to calories and saved to converted_calories.json');
            }
        );

    } catch (error) {
        console.error('Error processing data:', error);
    }
});