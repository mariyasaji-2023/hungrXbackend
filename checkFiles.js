const { MongoClient } = require("mongodb");

async function searchName() {
  const client = new MongoClient("mongodb+srv://hungrx001:b19cQlcRApahiWUD@cluster0.ynchc4e.mongodb.net/hungerX");
  const name = "coffee whitener";

  try {
    await client.connect();
    const grocery = client.db("hungerX").collection("grocery");

    const results = await grocery.aggregate([
      { $match: { name: name } }, // Match name in the first collection
      {
        $unionWith: {
          coll: "restaurants", // Name of the second collection
          pipeline: [{ $match: { name: name } }], // Match name in the second collection
        },
      },
    ]).toArray();

    console.log(results);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

searchName();


