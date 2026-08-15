export const InfoIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
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
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 11v5.5"/>
            <circle cx="12" cy="7.6" r="1.15" fill="currentColor" stroke="none"/>
        </svg>
    );
};
