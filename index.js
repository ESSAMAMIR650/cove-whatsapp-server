const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = "1056125900924733";

// Shopify order webhook
app.post("/order", async (req, res) => {
  const order = req.body;

  try {
    const phone =
      order.phone?.replace("+", "") ||
      order.customer?.phone?.replace("+", "") ||
      order.shipping_address?.phone?.replace("+", "");

    if (!phone) {
      console.log("No phone number found in order");
      return res.sendStatus(200);
    }

    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "hello_world",
          language: {
            code: "en_US"
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("WhatsApp test message sent to:", phone);
  } catch (err) {
    console.log("WhatsApp error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// WhatsApp webhook verification
app.get("/whatsapp", (req, res) => {
  const VERIFY_TOKEN = "cove_verify_123";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// WhatsApp replies webhook
app.post("/whatsapp", (req, res) => {
  console.log("WhatsApp reply:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Cove WhatsApp server is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
