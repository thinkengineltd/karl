// Keep supplied report imagery available without separate asset routes or cached responses.
import ben from '../public/ben.jpg';
import chloe from '../public/chloe.jpg';
import tom from '../public/tom.jpg';
import agencyLogo from '../public/agency-logo.jpg';
import clientLogo from '../public/client-logo.jpg';
import cover from '../public/cover.jpg';
const supplied={'ben.jpg':ben,'chloe.jpg':chloe,'tom.jpg':tom,'agency-logo.jpg':agencyLogo,'client-logo.jpg':clientLogo,'cover.jpg':cover};
export function resolveImage(src){
 if(typeof src!=='string'||!src)return '';
 const match=src.match(/^\/?(?:assets\/)?([^/?#]+)(?:[?#].*)?$/);
 return match&&supplied[match[1]]?supplied[match[1]]:src;
}
