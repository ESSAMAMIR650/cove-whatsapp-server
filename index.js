const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = "1056125900924733";

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

const VERIFY_TOKEN = "cove_verify_123";

async function getShopifyToken() {
  const response = await axios.post(
    `https://${SHOPIFY_SHOP}/admin/oauth/access_token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return response.data.access_token;
}

async function addShopifyTag(orderId, tag) {
  const token = await getShopifyToken();

  const mutation = `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { field message }
      }
    }
  `;

  const response = await axios.post(
    `https://${SHOPIFY_SHOP}/admin/api/2026-01/graphql.json`,
    {
      query: mutation,
      variables: {
        id: `gid://shopify/Order/${orderId}`,
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

  const errors = response.data?.data?.tagsAdd?.userErrors;
  if (errors?.length) throw new Error(JSON.stringify(errors));
}

// Shopify order webhook
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
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: order.customer?.first_name || "Customer" },
                { type: "text", text: order.name || "Order" },
                { type: "text", text: order.line_items?.[0]?.title || "Custom Product" },
                { type: "text", text: order.line_items?.[0]?.variant_title || "Not specified" },
                { type: "text", text: "Not specified" },
                { type: "text", text: order.total_price || "0" },
                {
                  type: "text",
                  text: order.shipping_address
                    ? `${order.shipping_address.address1 || ""}, ${order.shipping_address.city || ""}`
                    : "Not specified"
                }
              ]
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "0",
              parameters: [
                { type: "payload", payload: `confirm_${order.id}` }
              ]
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "1",
              parameters: [
                { type: "payload", payload: `cancel_${order.id}` }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    await addShopifyTag(order.id, "WhatsApp Sent");

    console.log("✅ WhatsApp sent + WhatsApp Sent tag added:", order.name);
  } catch (err) {
    console.log("❌ Order error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// Meta webhook verification
app.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// WhatsApp button replies webhook
app.post("/whatsapp", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const buttonText =
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      "";

    const payload =
      message.button?.payload ||
      message.interactive?.button_reply?.id ||
      "";

    console.log("Reply from:", from);
    console.log("Button clicked:", buttonText);
    console.log("Payload:", payload);

    if (payload.startsWith("confirm_")) {
      const orderId = payload.replace("confirm_", "");
      await addShopifyTag(orderId, "WhatsApp Confirmed");
      console.log("✅ Added tag: WhatsApp Confirmed");
    } else if (payload.startsWith("cancel_")) {
      const orderId = payload.replace("cancel_", "");
      await addShopifyTag(orderId, "Cancel Requested");
      console.log("✅ Added tag: Cancel Requested");
    } else {
      console.log("No valid payload found");
    }
  } catch (err) {
    console.log("❌ WhatsApp webhook error:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Cove WhatsApp server is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
