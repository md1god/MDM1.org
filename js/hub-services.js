(() => {
  const cards = document.querySelectorAll('.service-card');
  if (!cards.length) return;
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 70}ms`;
    card.classList.add('reveal');
  });
})();
