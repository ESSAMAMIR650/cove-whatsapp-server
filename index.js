const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = "1056125900924733";

// temporary storage (for demo)
let ordersMap = {};

// 🔹 Shopify webhook
app.post("/order", async (req, res) => {
  const order = req.body;

  const phone =
    order.phone?.replace("+", "") ||
    order.customer?.phone?.replace("+", "") ||
    order.shipping_address?.phone?.replace("+", "");

  if (!phone) {
    console.log("No phone number found");
    return res.sendStatus(200);
  }

  const name = order.customer?.first_name || "Customer";
  const orderId = order.id; // IMPORTANT (numeric ID)

  // store mapping
  ordersMap[phone] = orderId;

  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "order_confirmation",
          language: { code: "en" }
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
    console.log(err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// 🔹 WhatsApp replies
app.post("/whatsapp", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const button = message.button?.text;

    console.log("Reply:", button);

    const orderId = ordersMap[from];

    if (!orderId) {
      console.log("No order linked");
      return res.sendStatus(200);
    }

    // 🔹 Shopify API credentials
    const SHOP = "your-store-name.myshopify.com";
    const ACCESS_TOKEN = "your_shopify_admin_token";

    if (button === "Confirm") {
      await axios.put(
        `https://${SHOP}/admin/api/2024-01/orders/${orderId}.json`,
        {
          order: {
            id: orderId,
            tags: "Confirmed"
          }
        },
        {
          headers: {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("Order confirmed");
    }

    if (button === "Cancel") {
      await axios.post(
        `https://${SHOP}/admin/api/2024-01/orders/${orderId}/cancel.json`,
        {},
        {
          headers: {
            "X-Shopify-Access-Token": ACCESS_TOKEN
          }
        }
      );

      console.log("Order cancelled");
    }
  } catch (err) {
    console.log("Webhook error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// 🔹 verification
app.get("/whatsapp", (req, res) => {
  const VERIFY_TOKEN = "cove_verify_123";

  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }

  res.sendStatus(403);
});

app.listen(3000, () => console.log("Server running"));
