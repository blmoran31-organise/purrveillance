// PURRVEILLANCE: 🎲 name pools. The Office's own lists from 2026-10-03/04 were not on disk when this was built
// (searched the project folder, 00_Resources, 02_Outputs, 04_System and 99_HEXADEX); these follow the same five
// themes, and any list pasted in here replaces them. A ginger cat leans on the ginger pool, and so on.
export const POOLS = {
  magical: ['Merlin', 'Morgana', 'Hex', 'Pip the Unseen', 'Wanda', 'Grimalkin', 'Bramble', 'Thistle', 'Moonbeam', 'Nimue', 'Puck', 'Oberon', 'Sorcha', 'Wisp', 'Hecate', 'Mab'],
  puns: ['Purrlock Holmes', 'Catrick Swayze', 'Meowrio', 'Clawdia', 'Pawl McCartney', 'Chairman Meow', 'Fur Elise', 'Leonardo DiCatprio', 'Cat Damon', 'Sir Purrcival', 'Meowly Cyrus', 'Catniss', 'Pawdrey Hepburn', 'Furgus', 'Purrdita', 'Hairy Pawter'],
  ridiculous: ['Asteroid Destroyer', 'Gary', 'Keith from Accounts', 'The Duke of Bins', 'Small Steven', 'Lord Crumpet', 'Big Derek', 'Mrs Fluffington-Smythe', 'Toast', 'Captain Wednesday', 'Gregory Unbothered', 'Sausage Roll', 'Professor Biscuits', 'Nigel', 'Dave the Destroyer', 'Lasagne'],
  science: ['Schrodinger', 'Tesla', 'Ada', 'Newton', 'Curie', 'Hubble', 'Quark', 'Neutrino', 'Darwin', 'Hypatia', 'Pascal', 'Kepler', 'Boson', 'Rosalind', 'Fermi', 'Photon'],
  starship: ['Voyager', 'Enterprise', 'Serenity', 'Rocinante', 'Nostromo', 'Galactica', 'Discovery', 'Defiant', 'Millennium', 'Bebop', 'Tardis', 'Heart of Gold', 'Red Dwarf', 'Normandy', 'Icarus', 'Odyssey'],
};
// Coat-flavoured extras, mixed in when the cat's coat is known.
export const COAT_POOLS = {
  Ginger: ['Marmalade', 'Biscuit', 'Tango', 'Pumpkin', 'Rusty', 'Nacho', 'Garfield', 'Clementine', 'Cheeto', 'Satsuma'],
  Black: ['Shadow', 'Salem', 'Midnight', 'Onyx', 'Pepper', 'Eclipse', 'Licorice', 'Void', 'Panther', 'Soot'],
  Tux: ['Oreo', 'Tuxedo Jim', 'Penguin', 'Domino', 'Bond', 'Sylvester', 'Mr Smart', 'Piano', 'Magpie', 'Waiter'],
  Grey: ['Smokey', 'Ash', 'Pebble', 'Storm', 'Gandalf', 'Slate', 'Misty', 'Dusty', 'Cloud', 'Pewter'],
  Tabby: ['Tiger', 'Stripes', 'Tigger', 'Bengal Bob', 'Marble', 'Toffee', 'Mackerel', 'Hobbes', 'Bramble', 'Fudge'],
  White: ['Snowball', 'Ghost', 'Casper', 'Frost', 'Pearl', 'Blizzard', 'Marshmallow', 'Ivory', 'Yeti', 'Meringue'],
  Calico: ['Patches', 'Quilt', 'Confetti', 'Callie', 'Jigsaw', 'Pickle', 'Mosaic', 'Harlequin'],
  Tortie: ['Tortellini', 'Marmite', 'Treacle', 'Ember', 'Tiramisu', 'Brindle', 'Cinder', 'Mocha'],
  Cream: ['Custard', 'Butterscotch', 'Fudge', 'Latte', 'Biscotti', 'Vanilla', 'Honey', 'Crumble'],
  Brown: ['Cocoa', 'Bourbon', 'Hazel', 'Truffle', 'Bean', 'Conker', 'Gravy', 'Bisto'],
  'Siamese/pointed': ['Mango', 'Sapphire', 'Pharaoh', 'Cleo', 'Bao', 'Saffron', 'Mochi', 'Dim Sum'],
};
// A random name, leaning on the coat pool (1 in 2) when the cat's coat is known, and never the one just shown.
export function randomName(coats = [], previous = '') {
  const coatPool = coats.flatMap(c => COAT_POOLS[c] || []);
  const all = Object.values(POOLS).flat();
  for (let i = 0; i < 10; i++) {
    const pool = coatPool.length && Math.random() < 0.5 ? coatPool : all;
    const n = pool[Math.floor(Math.random() * pool.length)];
    if (n !== previous) return n;
  }
  return all[0];
}
