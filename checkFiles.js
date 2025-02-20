const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/apple-server-notifications', (req, res) => {
  console.log("Received app store notification:", req.body);

  const eventType = req.body.notification_type;

  switch (eventType) {
    case "DID_RENEW":
      console.log("subscription renewed:", req.body);
      break;
    case "CANCEL":
      console.log("subscription cancelled:", req.body);
      break;
    case "DID_FAIL_TO_RENEW":
      console.log("Subscription renewal failed:".req.body);
      break;
    default:
      console.log("other event:", eventType)
  }
 res.status(200).send("OK")
});

