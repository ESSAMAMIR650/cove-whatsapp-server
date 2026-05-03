const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = "1056125900924733";

// 🔹 Shopify token generator
async function getShopifyToken() {
  const response = await axios.post(
    https://${process.env.SHOPIFY_SHOP}/admin/oauth/access_token,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET
    })
  );

  return response.data.access_token;
}

// 🔹 Add tag to Shopify order
async function addOrderTag(orderId) {
  try {
    const token = await getShopifyToken();
    const gid = gid://shopify/Order/${orderId};

    await axios.post(
      https://${process.env.SHOPIFY_SHOP}/admin/api/2026-01/graphql.json,
      {
        query: 
          mutation tagsAdd($id: ID!, $tags: [String!]!) {
            tagsAdd(id: $id, tags: $tags) {
              node { id }
              userErrors { field message }
            }
          }
        ,
        variables: {
          id: gid,
          tags: ["WhatsApp Sent"]
        }
      },
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Tag added successfully");
  } catch (err) {
    console.log("❌ Shopify tag error:", err.response?.data || err.message);
  }
}

// 🔹 Shopify webhook endpoint
app.post("/order", async (req, res) => {
  console.log("🔥 Shopify webhook received");

  const order = req.body;

  console.log("Order ID:", order.id);
  console.log("Order name:", order.name);
  console.log("Order phone:", order.phone);
  console.log("Customer phone:", order.customer?.phone);
  console.log("Shipping phone:", order.shipping_address?.phone);

  const phone =
    order.phone?.replace("+", "") ||
    order.customer?.phone?.replace("+", "") ||
    order.shipping_address?.phone?.replace("+", "");

  console.log("Final phone used:", phone);

  if (!phone) {
    console.log("❌ No phone number found");
    return res.sendStatus(200);
  }

  try {
    // 🔹 Send WhatsApp message
    await axios.post(
      https://graph.facebook.com/v20.0/${PHONE_ID}/messages,
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
          Authorization: Bearer ${WHATSAPP_TOKEN},
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WhatsApp message sent");

    // 🔹 Add tag
    await addOrderTag(order.id);

  } catch (err) {
    console.log("❌ WhatsApp error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// 🔹 Test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
