/* ============ funding.js — donations ============
 * Donations are voluntary, give no in-game advantage and are used only to
 * keep the game online: servers and domain.
 * This file is the source of what is shown in the game ("Support" button)
 * and on the /apoyar/ page. Updated by hand:
 *
 *   kofi      Ko-fi username (empty = the button is hidden)
 *   sponsors  GitHub Sponsors username (for people who visit the repository)
 *   costs     expenses [item, euros per month]; if the cost is not fixed, a text
 */
G.Funding = {
  kofi: 'jpter78',
  sponsors: 'JPTER78',
  costs: [
    ['Servers (saves, accounts, leaderboards and multiplayer)', 'Depends on how many people play'],
    ['Domain pokesurvivor.com', '≈€12 per year']
  ],
  get url() {
    return this.kofi ? 'https://ko-fi.com/' + this.kofi : '';
  }
};
