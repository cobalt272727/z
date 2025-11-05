$(function() {
	var headerHeight = $('header').outerHeight(),
		startPos = 0;
	$(window).on('load scroll', function() {
		var scrollPos = $(this).scrollTop();
		if ( scrollPos > startPos && scrollPos > headerHeight ) {
			$('header').css('transform', 'translateY(-100%)');
		} else {
			$('header').css('transform', 'translateY(0)');
		}
		startPos = scrollPos;
	});
});	