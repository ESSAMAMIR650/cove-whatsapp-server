const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = "1056125900924733";

// 🔹 Get Shopify token (auto every time)
async function getShopifyToken() {
  const response = await axios.post(
    `https://${process.env.SHOPIFY_SHOP}/admin/oauth/access_token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET
    })
  );

  return response.data.access_token;
}

// 🔹 Add tag to order
async function addOrderTag(orderId, tag) {
  try {
    const token = await getShopifyToken();

    const gid = `gid://shopify/Order/${orderId}`;

    await axios.post(
      `https://${process.env.SHOPIFY_SHOP}/admin/api/2026-01/graphql.json`,
      {
        query: `
          mutation tagsAdd($id: ID!, $tags: [String!]!) {
            tagsAdd(id: $id, tags: $tags) {
              node { id }
              userErrors { field message }
            }
          }
        `,
        variables: {
          id: gid,
          tags: [tag]
        }
      },
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Shopify tag added:", tag);
  } catch (err) {
    console.log("❌ Shopify tag error:", err.response?.data || err.message);
  }
}

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
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WhatsApp message sent to:", phone);

    // 🔥 Add Shopify tag after sending message
    await addOrderTag(order.id, "WhatsApp Sent");

  } catch (err) {
    console.log("❌ WhatsApp error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// 🔹 Health check
app.get("/", (req, res) => {
  res.send("Cove WhatsApp server is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
