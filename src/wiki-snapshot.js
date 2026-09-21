const cheerio = require('cheerio');
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

function parseWikiDetail(html, id) {
  const $ = cheerio.load(html);
  const unit = $('.game-unit').first();
  const canonical = $('link[rel="canonical"]').attr('href');
  if (!unit.length || canonical?.toLowerCase() !== `https://wiki.warthunder.com/unit/${id}`.toLowerCase()) throw new Error(`${id}: missing unit or mismatched canonical URL`);
  const cards = new Map();
  unit.find('.game-unit_card-info_item').each((_,element) => {
    const item = $(element);
    const label = clean(item.find('.game-unit_card-info_title').text());
    const value = item.find('.game-unit_card-info_value').first();
    const copy = value.clone();
    copy.find('svg,img').remove();
    cards.set(label, {text:clean(copy.text()) || null, currency:value.find('img[alt]').first().attr('alt') || null});
  });
  const get = key => cards.get(key)?.text || null;
  const basicUnit = unit.find('a.game-unit_multiunit-item').filter((_,e)=>clean($(e).find('.subtitle').text())==='Basic unit').attr('href');
  const componentOf = basicUnit?.startsWith('/unit/') ? basicUnit.slice('/unit/'.length) : null;
  const ratingsByBattle = {};
  unit.find('.game-unit_br-item').each((_,element)=>{
    const mode = clean($(element).find('.mode').text());
    const value = clean($(element).find('.value').text());
    const battle = $(element).closest('.tab-pane').attr('id')?.replace('unit-br-', '') || 'default';
    const ratings = ratingsByBattle[battle] ||= {};
    if (ratings[mode] && ratings[mode] !== value) throw new Error(`${id}: ambiguous ${mode} BR`);
    if (mode) ratings[mode] = value;
  });
  const battle = unit.find('.game-unit_br .tab-pane.active').attr('id')?.replace('unit-br-', '') || 'default';
  const ratings = ratingsByBattle[battle] || {};
  if (!componentOf && !/^\d+\.\d$/.test(ratings.RB || '')) throw new Error(`${id}: missing RB battle rating`);
  if ((!componentOf && !/^[IVX]+$/.test(get('Rank') || '')) || !get('Research country') || !get('Main role')) throw new Error(`${id}: incomplete detail page`);
  const premium = unit.hasClass('game-unit--premium');
  const squadron = unit.hasClass('game-unit--squadron');
  function number(text) {
    if (text === null) return null;
    if (/^free$/i.test(text)) return 0;
    if (!/^\d[\d, ]*$/.test(text)) throw new Error(`${id}: unexpected cost ${text}`);
    return Number(text.replace(/[, ]/g, ''));
  }
  const research = get('Research');
  const purchase = get('Purchase');
  const currency = cards.get('Purchase')?.currency || (purchase === 'Free' ? 'SL' : null);
  const rp = number(research);
  const sl = currency === 'SL' ? number(purchase) : null;
  return {
    br:ratings.RB || null, rank:get('Rank'), research_country:get('Research country'), main_role:get('Main role'),
    is_component:Boolean(componentOf), component_of:componentOf,
    is_premium:premium, is_squadron:squadron, details:true,
    rp:premium || squadron || componentOf ? 0 : rp, sp:premium || squadron || componentOf ? 0 : sl,
    wiki:{url:canonical, rank:get('Rank'), battle_rating_context:battle, battle_ratings:ratings, battle_ratings_by_battle:ratingsByBattle, research, purchase, purchase_currency:currency, status:get('Status')},
  };
}

module.exports = {parseWikiDetail};
