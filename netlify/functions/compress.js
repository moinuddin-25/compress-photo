const sharp = require('sharp');

exports.handler = async (event, context) => {
  try {
    const { imageData, format = 'webp', quality = 80 } = JSON.parse(event.body);
    const buffer = Buffer.from(imageData.split(',')[1], 'base64');
    const compressedImage = await sharp(buffer)
      .toFormat(format, { quality: parseInt(quality) })
      .toBuffer();
    return {
      statusCode: 200,
      body: JSON.stringify({
        compressedImage: `data:image/${format};base64,${compressedImage.toString('base64')}`
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
