// netlify/functions/compress.js
const sharp = require('sharp');

exports.handler = async (event, context) => {
  try {
    // Check if event.body exists
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No request body provided' }),
      };
    }

    // Parse the JSON body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON payload: ' + parseError.message }),
      };
    }

    // Validate required fields
    const { imageData, format = 'webp', quality = 80 } = body;
    if (!imageData || !imageData.startsWith('data:image/')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or missing imageData' }),
      };
    }

    // Extract base64 data from DataURL
    const base64Data = imageData.split(',')[1];
    if (!base64Data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid imageData format' }),
      };
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Compress image using sharp
    const compressedImage = await sharp(buffer)
      .toFormat(format, { quality: parseInt(quality) })
      .toBuffer();

    return {
      statusCode: 200,
      body: JSON.stringify({
        compressedImage: `data:image/${format};base64,${compressedImage.toString('base64')}`,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error: ' + err.message }),
    };
  }
};
