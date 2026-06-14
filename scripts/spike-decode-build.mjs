// One-off spike: decode the user's example build code and dump the result.
// We use the @gw2/chatlink library to do the actual decoding.

import { decodeChatlink, ChatlinkType } from '@gw2/chatlink';

const code = '[&DQIkLTM+EiryEgAA3BIAANcSAACoAAAAwhIAAAAAAAAAAAAAAAAAAAAAAAA=]';

try {
  const result = decodeChatlink(code);
  console.log('Chatlink type:', result.type, '(expected 13 = BuildTemplate)');
  console.log('Type name:', ChatlinkType[result.type]);
  console.log('');
  console.log('Decoded data:');
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');

  // What fields does the result have?
  const fields = Object.keys(result.data);
  console.log('Field count:', fields.length);
  console.log('Fields:', fields.join(', '));
  console.log('');

  // Any field that looks like an item ID (likely large number)?
  const itemIdLikeFields = fields.filter(f => {
    const v = result.data[f];
    return typeof v === 'number' && v > 1000;
  });
  console.log('Fields with values > 1000 (likely item IDs):', itemIdLikeFields);
  console.log('Their values:', itemIdLikeFields.map(f => `${f}=${result.data[f]}`).join(', '));
} catch (e) {
  console.error('Decode failed:', e.message);
  process.exit(1);
}
