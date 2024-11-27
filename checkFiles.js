const mongoose = require('mongoose');
const Meal = require('./models/mealModel'); // Update with the correct path

// Connect to MongoDB
mongoose.connect('mongodb+srv://hungrx001:b19cQlcRApahiWUD@cluster0.ynchc4e.mongodb.net/hungerX', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

// Define the meal data
const meals = [
    { meal: 'Breakfast' },
    { meal: 'Lunch' },
    { meal: 'Dinner' },
    { meal: 'Snacks' },
];

// Insert the meals into the collection
Meal.insertMany(meals)
    .then((docs) => {
        console.log('Meals added successfully:', docs);
        mongoose.connection.close(); // Close the connection after insertion
    })
    .catch((err) => {
        console.error('Error adding meals:', err);
        mongoose.connection.close(); // Close the connection even if there’s an error
    });
