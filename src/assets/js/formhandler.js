document.getElementById('contact-form').addEventListener('submit', function (event) {
    // Prevent default form submission behavior
    event.preventDefault();

    // Get form values
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    // Construct mailto link
    const subject = encodeURIComponent(`Message from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
    const mailtoLink = `mailto:youremail@example.com?subject=${subject}&body=${body}`;

    // Open the mailto link
    window.location.href = mailtoLink;
});

document.querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
});