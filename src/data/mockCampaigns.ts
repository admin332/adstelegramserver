export interface Campaign {
  id: string;
  name: string;
  imageUrl: string;
  text: string;
  buttonText: string;
  buttonUrl: string;
}

export const mockCampaigns: Campaign[] = [
  {
    id: "1",
    name: "Крипто Кошелёк Pro",
    imageUrl: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400",
    text: "Безопасный криптокошелёк с поддержкой 100+ монет. Храни и обменивай крипту без комиссий!",
    buttonText: "Скачать бесплатно",
    buttonUrl: "https://example.com/wallet",
  },
];
