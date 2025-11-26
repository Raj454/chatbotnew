import React from 'react';
import craffteineLogo from '../../src/assets/craffteine-logo.jpg';

interface AIBotIconProps {
  className?: string;
}

export const AIBotIcon: React.FC<AIBotIconProps> = ({ className = 'w-6 h-6' }) => {
  return (
    <img 
      src={craffteineLogo}
      alt="Craffteine AI Assistant"
      className={`${className} rounded-full object-cover`}
    />
  );
};
