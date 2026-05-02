const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔐 Replace with your WhatsApp token later
const TOKEN = process.env.WHATSAPP_TOKEN;

// 📱 Your Cove Phone Number ID
const PHONE_ID = "1056125900924733";

// 🔹 Shopify webhook
app.post("/order", async (req, res) => {
  const order = req.body;

  try {
    const name = order.customer?.first_name || "Customer";
    const orderId = order.name || "Order";
    const phone = order.phone?.replace("+", "") || null;

    if (!phone) {
      console.log("No phone number found");
      return res.sendStatus(200);
    }

    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "order_confirmation",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: name },
                { type: "text", text: orderId }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Message sent to:", phone);
  } catch (err) {
    console.log("Error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// 🔹 WhatsApp webhook (for later Confirm/Cancel)
app.post("/whatsapp", (req, res) => {
  console.log("WhatsApp reply:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// 🔹 Verification (required by Meta)
app.get("/whatsapp", (req, res) => {
  const VERIFY_TOKEN = "cove_verify_123";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
