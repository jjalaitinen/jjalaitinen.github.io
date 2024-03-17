var eka = document.getElementById("ekaTikka");
var toka = document.getElementById("tokaTikka");
var kolmas = document.getElementById("kolmasTikka");
var moving = false;

eka.addEventListener("mousedown", initialClick, false);
toka.addEventListener("mousedown", initialClick, false);
kolmas.addEventListener("mousedown", initialClick, false);

function move(e) {
  var newX = e.pageX - 10;
  var newY = e.pageY - 10;

  image.style.left = newX + "px";
  image.style.top = newY + "px";
}

function initialClick(e) {
  if (moving) {
    document.removeEventListener("mousemove", move);
    moving = !moving;
    return;
  }

  moving = !moving;
  image = this;

  document.addEventListener("mousemove", move, false);
}
