package com.graffiti;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main application entry point for the Graffiti Real-Time Collaborative Whiteboard Backend.
 *
 * Enables Spring Boot auto-configuration, component scanning across sub-packages,
 * and background task scheduling for periodic snapshot compaction scans.
 */
@SpringBootApplication
@EnableScheduling
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

}
