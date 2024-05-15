
window.onload = () => {
  password();
};

function password() {
  let p = prompt("salasana:");
  p === "talv3nTu!o" ? true : password();
}
