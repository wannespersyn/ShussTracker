export const TrophyIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}>
            <path d="M8 4h8v4.5a4 4 0 0 1-8 0z"/>
            <path d="M8 5.5H5.5V7a3 3 0 0 0 3 3M16 5.5h2.5V7a3 3 0 0 1-3 3M12 12.5V16M9 20h6l-.7-4h-4.6z"/>
        </svg>
    );
};
