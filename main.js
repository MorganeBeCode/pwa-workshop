// Get template
const template = document.querySelector("#template");
// Get comments div
const comments = document.getElementById("comments");

// DISPLAY FEED
// GET request using fetch()
fetch("https://jsonplaceholder.typicode.com/comments?_start=1&_limit=15")
  // Converting received data to JSON
  .then(response => response.json())
  .then(json => {
    // Loop through each data and add a card
    json.forEach(comment => {
      const clone = document.importNode(template.content, true);
      clone.querySelector("#name").innerText = comment.name;
      clone.querySelector("#email").innerText = comment.email;
      clone.querySelector("#text").innerText = comment.body;
      // Push card on top of the feed
      comments.insertBefore(clone, comments.firstChild);
    });
  })
  .catch(function(error) {
    console.log("Problem with fetch: " + error.message);
  });

// WRITE MESSAGE
document.querySelector("#share").addEventListener("click", () => {
  if (navigator.onLine) {
    let message = document.querySelector("#message").value;
    let title = document.querySelector("#title").value;
    let comments = document.getElementById("comments");
    const tplClone = document.importNode(template.content, true);
    tplClone.querySelector("#name").innerText = title;
    tplClone.querySelector("#email").innerText = "jane.doe@gmail.com";
    tplClone.querySelector("#text").innerText = message;
    tplClone
      .querySelector("img")
      .setAttribute("src", "https://i.picsum.photos/id/306/70");
    comments.insertBefore(tplClone, comments.firstChild);
  } else {
    $(".alert").slideDown();
    setTimeout(function() {
      $(".alert").slideUp();
    }, 4000);
  }
});
