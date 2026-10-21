/** Contact details: every number, e-mail and link must be usable (no placeholders). */
import { SANAD_PHONES, SANAD_EMAILS, SANAD_SOCIALS, telHref, waHref, mailHref } from '../src/lib/contact.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + d)); };

console.log('\n=== phones ===');
ok('three numbers', SANAD_PHONES.length === 3, String(SANAD_PHONES.length));
ok('all Sudan country code 249', SANAD_PHONES.every((p) => p.raw.startsWith('249') && p.raw.length === 12), JSON.stringify(SANAD_PHONES.map(p => p.raw)));
ok('raw digits only', SANAD_PHONES.every((p) => /^\d+$/.test(p.raw)));
ok('tel: links valid', SANAD_PHONES.every((p) => telHref(p.raw) === `tel:+${p.raw}`));
ok('wa.me links valid', SANAD_PHONES.every((p) => waHref(p.raw).startsWith(`https://wa.me/${p.raw}?text=`)));
ok('display numbers match raw', SANAD_PHONES.every((p) => p.display.replace(/[^\d]/g, '') === p.raw), JSON.stringify(SANAD_PHONES.map(p => p.display)));
ok('the three numbers given by the owner exist',
  ['249966704757', '249913009060', '249114537190'].every((n) => SANAD_PHONES.some((p) => p.raw === n)));
ok('every number has a label', SANAD_PHONES.every((p) => p.label.trim().length > 2));

console.log('\n=== e-mails ===');
ok('two addresses', SANAD_EMAILS.length === 2);
ok('valid e-mail shape', SANAD_EMAILS.every((e) => /^[\w.+-]+@[\w-]+\.[\w.]{2,}$/.test(e.address)), JSON.stringify(SANAD_EMAILS));
ok('owner addresses present',
  ['alsiralsaig@gmail.com', 'tajalsir2026@gmail.com'].every((a) => SANAD_EMAILS.some((e) => e.address === a)));
ok('mailto: link valid', mailHref('alsiralsaig@gmail.com').startsWith('mailto:alsiralsaig@gmail.com?subject='));

console.log('\n=== social pages ===');
ok('four channels', SANAD_SOCIALS.length === 4, String(SANAD_SOCIALS.length));
ok('all https', SANAD_SOCIALS.every((s) => s.url.startsWith('https://')));
ok('no tracking params', SANAD_SOCIALS.every((s) => !/[?&](_r|_t|obrf|igsh|si)=/.test(s.url)), JSON.stringify(SANAD_SOCIALS.map(s => s.url)));
ok('tiktok handle correct', SANAD_SOCIALS.some((s) => s.url === 'https://www.tiktok.com/@alsiralsaig2'));
ok('instagram handle correct', SANAD_SOCIALS.some((s) => s.url === 'https://www.instagram.com/alsir_alsaig1'));
ok('youtube channel correct', SANAD_SOCIALS.some((s) => s.url === 'https://www.youtube.com/@ParadiseTech_1'));
ok('facebook page link kept', SANAD_SOCIALS.some((s) => s.url.includes('facebook.com/share/1FQj9wqxCv')));
ok('no placeholder links (facebook.com alone, youtube.com alone…)',
  SANAD_SOCIALS.every((s) => new URL(s.url).pathname.length > 1));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
