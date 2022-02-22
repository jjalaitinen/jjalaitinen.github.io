// Animoidaan skills-barit kauniisti
function animoiSkills() {
  let bars = document.querySelectorAll("progress");
  const skill_level_t = [
    { taito: "java", taso: 50 },
    { taito: "python", taso: 75 },
    { taito: "js", taso: 75 },
    { taito: "c#", taso: 25 },
    { taito: "html_css", taso: 75 },
    { taito: "sql_db", taso: 50 },
    { taito: "general", taso: 75 },
    { taito: "edu", taso: 75 },
    { taito: "social", taso: 100 },
  ];
  setTimeout(() => {
    for (let i = 0; i < bars.length; i++) {
      let taito = bars[i].parentElement.id;
      for (let j = 0; j < skill_level_t.length; j++) {
        if (taito == skill_level_t[j].taito) {
          let taso = skill_level_t[j].taso;
          bars[i].setAttribute("value", taso);
          bars[i].style.setProperty("--value", taso + "%");
        }
      }
    }
  }, 100);
}
// Nollataan barien arvo, jotta animaatiot näkyvät uudestaan.
function nollaaBarit() {
  let bars = document.querySelectorAll("progress");
  for (let i = 0; i < bars.length; i++) {
    bars[i].setAttribute("value", 0);
    bars[i].style.setProperty("--value", 0 + "%");
  }
}
function clickHandle(e, tab) {
  //Nollataan edelliset näkymästä helvettiin
  let tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  // Asetetaan tietty välilehti aktiiviseksi
  let tablinks = document.getElementsByClassName("tab_linkki");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tab).style.display = "flex";
  e.currentTarget.className += " active";

  if (tab == "skills") {
    animoiSkills();
  } else {
    nollaaBarit();
  }
}

// Asetetaan tumma teema
function enableDarkMode(theme) {
  //asetetaan tumman teeman css-tiedosto
  theme.href = "darkmode.css";
  //asetetaan kuu-ikoni auringoksi ja katana harmaaksi
  let kuu = document.getElementById("kuu");
  kuu.src = "./pictures/sun.png";
  let katana = document.getElementById("katana");
  katana.src = "./pictures/katana_dark.png";
  //asetaan logojen värit harmaiksi
  let github = document.getElementById("github_logo");
  github.src = "./pictures/github_logo_dark.png";
  let linkedIn = document.getElementById("linkedIn_logo");
  linkedIn.src = "./pictures/li_logo_dark.png";
  let twitter = document.getElementById("twitter_logo");
  twitter.src = "./pictures/twitter_logo_dark.png";
  let mail = document.getElementById("email_logo");
  mail.src = "./pictures/mail_logo_dark.png";
}

// Asetataan vaalea teema
function enableLightMode(theme) {
  //ladataan sivu alkuasetuksille uudestaan ja asetetaan normi näkymä:
  window.location.reload();
}

//tätä ennen voisi tarkastaa onko sivu jo killbillissä jos on niin vaihdetaan takaisin aurinkoiseen? miekka voitaisiin animmoida kääntymään

function unleashTheBeast(e) {
  //merkit takaisin mustiksi
  let github = document.getElementById("github_logo");
  github.src = "./pictures/github_logo.png";
  let linkedIn = document.getElementById("linkedIn_logo");
  linkedIn.src = "./pictures/li_logo.png";
  let twitter = document.getElementById("twitter_logo");
  twitter.src = "./pictures/twitter_logo.png";
  let mail = document.getElementById("email_logo");
  mail.src = "./pictures/mail_logo.png";
  //teema oikeaksi
  const teema = document.querySelector("#theme-link");
  teema.href = "killbill.css";
  //katana punaiseksi
  let katana = document.getElementById("katana");
  katana.src = "./pictures/katana_tappo.png";
}

// Funktio vaihtamaan erilainen css-tyylitiedosto
function enableDifferentMode(e) {
  let tila = e.currentTarget.id;
  let theme = document.querySelector("#theme-link");
  //Jos tämänhetkinen tila on Lightmode, niin muutetaan se darkmodeen
  if (tila === "lightmode") {
    //Muutetaan tila tummaan
    enableDarkMode(theme);
    //muutetaan klikin jälkeen tapahtuvan näkymän id "darkmodeen"
    e.currentTarget.setAttribute("id", "darkmode");
    //vaihdetaan näkymään toinen vaihtoehto (väliaikainen)
  } else {
    //Muutetaan tila vaaleaksi
    enableLightMode(theme);
    //muutetaan klikin jälkeen tapahtuvan näkymän id
    e.currentTarget.setAttribute("id", "lightmode");
    //vaihdetaan näkymään toinen vaihtoehto
  }
}

// Pakollinen attribuutio iconeiden tekijöitä varten
function naytaCreditit() {
  let credits = document.getElementById("iconcredit_teksti");
  let nappi = document.getElementById("credits_button");
  if (credits.style.display == "flex") {
    credits.style.display = "none";
    nappi.className = "";
  } else {
    credits.style.display = "flex";
    // Asetetaan button aktiiviseksi
    nappi.className = "active";
  }
}
//kun sivu ladataan
window.addEventListener("load", function () {
  //tämä tehdään, kun sivu ladataan (avaa ekan tabin :D)
  document.getElementsByClassName("tab_linkki")[0].click();
});
