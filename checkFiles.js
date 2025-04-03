// clearUrl.js - Script to clear URL values from a specific subcategory using category and subcategory IDs
const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection settings
const uri = 'mongodb+srv://hungrx001:hungrxmongo@cluster0.ynchc4e.mongodb.net/hungerX';
const dbName = 'hungerX'; // Update with your actual database name
const collectionName = 'restaurants'; // Update with your actual collection name

// Function to clear URL values from a specific subcategory
async function clearSubcategoryUrl(categoryId, subcategoryId) {
  const client = new MongoClient(uri);

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Find the restaurant document
    const restaurant = await collection.findOne({
      "categories._id": new ObjectId(categoryId)
    });

    if (!restaurant) {
      console.error(`No restaurant found with category ID: ${categoryId}`);
      return;
    }

    // Find the category index
    const categoryIndex = restaurant.categories.findIndex(
      cat => cat._id.toString() === categoryId
    );

    if (categoryIndex === -1) {
      console.error(`Category with ID ${categoryId} not found`);
      return;
    }

    const category = restaurant.categories[categoryIndex];
    console.log(`Found category: ${category.categoryName}`);

    // Check if the category has a subCategories array
    if (!category.subCategories || !Array.isArray(category.subCategories)) {
      console.error(`No subCategories found in category ${category.categoryName}`);
      return;
    }

    // Find the subcategory index
    const subCategoryIndex = category.subCategories.findIndex(
      subCat => subCat._id.toString() === subcategoryId
    );

    if (subCategoryIndex === -1) {
      console.error(`Subcategory with ID ${subcategoryId} not found in category ${category.categoryName}`);
      return;
    }

    const subCategory = category.subCategories[subCategoryIndex];
    console.log(`Found subcategory: ${subCategory.subCategoryName}`);

    // Check if the subcategory has dishes
    if (!subCategory.dishes || !Array.isArray(subCategory.dishes) || subCategory.dishes.length === 0) {
      console.log(`No dishes found in subcategory ${subCategory.subCategoryName}`);
      return;
    }

    // Process each dish in the subcategory
    let updated = false;
    for (let dishIndex = 0; dishIndex < subCategory.dishes.length; dishIndex++) {
      const dish = subCategory.dishes[dishIndex];
      
      // Check if the dish has servingInfos
      if (!dish.servingInfos || !Array.isArray(dish.servingInfos)) {
        continue;
      }
      
      // Process each servingInfo in the dish
      for (let servingIndex = 0; servingIndex < dish.servingInfos.length; servingIndex++) {
        const servingInfo = dish.servingInfos[servingIndex];
        
        if (servingInfo.servingInfo && servingInfo.servingInfo.Url && servingInfo.servingInfo.Url.trim() !== '') {
          console.log(`Clearing URL value from dish "${dish.dishName}" (size: ${servingInfo.servingInfo.size})`);
          // Store the original URL for logging
          const originalUrl = servingInfo.servingInfo.Url;
          // Set URL to empty string
          servingInfo.servingInfo.Url = "";
          updated = true;
          console.log(`Original URL: ${originalUrl} → Cleared`);
        }
      }
    }

    if (!updated) {
      console.log('No URLs found to clear in this subcategory');
      return;
    }

    // Build the update path for MongoDB
    const updatePath = `categories.${categoryIndex}.subCategories.${subCategoryIndex}`;
    
    // Update the document in MongoDB
    const result = await collection.updateOne(
      { _id: restaurant._id },
      { $set: { [updatePath]: subCategory } }
    );

    console.log(`Modified ${result.modifiedCount} document(s)`);
    console.log(`Successfully cleared URL values from subcategory "${subCategory.subCategoryName}" in category "${category.categoryName}"`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Command line argument parsing
function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: node clearUrl.js <categoryId> <subcategoryId>');
    process.exit(1);
  }
  
  const categoryId = args[0];
  const subcategoryId = args[1];
  
  // Validate IDs
  if (!ObjectId.isValid(categoryId) || !ObjectId.isValid(subcategoryId)) {
    console.error('Invalid ID format. Both categoryId and subcategoryId must be valid MongoDB ObjectId values');
    process.exit(1);
  }
  
  // Call the clear function
  clearSubcategoryUrl(categoryId, subcategoryId)
    .catch(console.error);
}

// Execute the main function
main();