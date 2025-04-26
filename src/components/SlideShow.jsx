import React, { useState, useRef, useCallback, useMemo } from 'react';
import './style/collection.css';

const SlideShow = ({ collections, totalSteps, onCardClick }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const touchStartX = useRef(null);

  const handleNext = useCallback(() => {
    setCurrentStep((prevStep) => (prevStep % totalSteps) + 1);
  }, [totalSteps]);

  const handlePrevious = useCallback(() => {
    setCurrentStep((prevStep) =>
      prevStep - 1 <= 0 ? totalSteps : prevStep - 1
    );
  }, [totalSteps]);

  const handleTouchStart = useCallback((event) => {
    touchStartX.current = event.touches ? event.touches[0].clientX : event.clientX;
  }, []);

  const handleTouchEnd = useCallback((event) => {
    const endX = event.changedTouches
      ? event.changedTouches[0].clientX
      : event.clientX;
    const deltaX = touchStartX.current - endX;

    if (deltaX > 50) {
      handleNext();
    } else if (deltaX < -50) {
      handlePrevious();
    }
  }, [handleNext, handlePrevious]);

  const cardClass = useCallback((collectionIndex) => {
    if (collectionIndex === currentStep - 1)
      return 'collections-nftcard collections-nftprincipal';
    if (
      collectionIndex === currentStep - 2 ||
      (currentStep === 1 && collectionIndex === totalSteps - 1)
    )
      return 'collections-nftcard collections-nftanterior';
    if (collectionIndex === currentStep)
      return 'collections-nftcard collections-nftsiguiente';
    return 'collections-nftcard collections-nftocultar';
  }, [currentStep, totalSteps]);

  const renderedCards = useMemo(() => (
    collections.map((collection, index) => (
      <div
        key={collection.id || index}
        className={cardClass(index)}
        id={`collections-nftcard-${index}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart} // ✅ Added mouse support
        onMouseUp={handleTouchEnd}     // ✅ Added mouse support
        onClick={() => onCardClick(collection)}
      >
        <div className="collections-nftcard-image">
          <img src={collection.image} alt={collection.name} />
        </div>
      </div>
    ))
  ), [collections, cardClass, handleTouchStart, handleTouchEnd, onCardClick]);

  return (
    <div className="collections-nftcontenedor">
      {renderedCards}
      <div id="div-transparent-previous" onClick={handlePrevious}></div>
      <div id="div-transparent-next" onClick={handleNext}></div>
    </div>
  );
};

export default SlideShow;
